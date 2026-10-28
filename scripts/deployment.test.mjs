import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { test } from "node:test";

import { checkHealth } from "./healthcheck.mjs";
import { renderDeploymentTemplate } from "./render-deployment.mjs";
import { validateDeploymentEnv } from "./validate-deployment-env.mjs";

const environment = {
  ADMIN_HOST: "admin.example.com",
  VITE_API_BASE_URL: "https://api.example.com",
  VITE_APP_BASE_URL: "/console/",
  VITE_RELEASE_ID: "synthetic-v1",
  TLS_CERTIFICATE: "/etc/tls/fullchain.pem",
  TLS_CERTIFICATE_KEY: "/etc/tls/privkey.pem",
  ADMIN_ROOT: "/srv/kernel-admin/current/public",
  HTTPS_PORT: "8443",
};

test("public configuration rejects malformed origins, paths and release identifiers", () => {
  assert.equal(validateDeploymentEnv(environment).basePath, "/console/");
  for (const patch of [
    { VITE_API_BASE_URL: "http://public.example.com" },
    { VITE_API_BASE_URL: "https://user:pass@api.example.com" },
    { VITE_APP_BASE_URL: "/../" },
    { VITE_APP_BASE_URL: "/console" },
    { VITE_RELEASE_ID: "../release" },
  ])
    assert.throws(() => validateDeploymentEnv({ ...environment, ...patch }));
  assert.doesNotThrow(() =>
    validateDeploymentEnv({
      ...environment,
      VITE_OBSERVABILITY_URL: "https://observe.example.com/events",
    }),
  );
});

test("renders root/subpath TLS SPA, immutable assets, explicit API CSP and unmodified Nginx variables", async () => {
  const template = await readFile(
    new URL("../deploy/native/nginx/admin.conf.template", import.meta.url),
    "utf8",
  );
  for (const basePath of ["/", "/console/"]) {
    const rendered = renderDeploymentTemplate(template, {
      ...environment,
      VITE_APP_BASE_URL: basePath,
    });
    assert.ok(rendered.includes(`try_files $uri $uri/ ${basePath}index.html;`));
    assert.ok(rendered.includes(`location ^~ ${basePath}assets/`));
    assert.ok(rendered.includes("https://$host:8443$request_uri"));
    for (const token of [
      "ssl_protocols TLSv1.2 TLSv1.3",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "https://api.example.com",
      "X-Content-Type-Options",
      "max-age=31536000, immutable",
    ])
      assert.ok(rendered.includes(token), token);
    assert.equal(rendered.includes("${"), false);
    assert.equal(rendered.includes("proxy_pass"), false);
  }
  for (const patch of [
    { ADMIN_HOST: "host;bad" },
    { ADMIN_HOST: "-host.example" },
    { TLS_CERTIFICATE: "/etc/../private" },
    { HTTPS_PORT: "70000" },
  ])
    assert.throws(() =>
      renderDeploymentTemplate(template, { ...environment, ...patch }),
    );
  assert.throws(
    () => renderDeploymentTemplate("${BETTER_AUTH_SECRET}", environment),
    /Unknown/,
  );
  assert.ok(
    renderDeploymentTemplate(template, {
      ...environment,
      VITE_OBSERVABILITY_URL: "https://observe.example.com/events",
    }).includes(
      "connect-src 'self' https://api.example.com https://observe.example.com;",
    ),
  );
});

test("readiness requires real HTML and matching immutable release, rejects redirects and errors", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/console/_kernel/release") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ release: "synthetic-v1" }));
      return;
    }
    if (request.url === "/redirect") {
      response.writeHead(302, { Location: "/console/" });
      response.end();
      return;
    }
    response.setHeader(
      "Content-Type",
      request.url === "/console/" ? "text/html" : "application/json",
    );
    response.end(request.url === "/console/" ? "<html>synthetic</html>" : "{}");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    await checkHealth(`${origin}/console/`, "synthetic-v1");
    await assert.rejects(
      checkHealth(`${origin}/console/`, "wrong"),
      /Unexpected/,
    );
    await assert.rejects(checkHealth(`${origin}/invalid`), /not ready/);
    await assert.rejects(checkHealth(`${origin}/redirect`));
    await assert.rejects(checkHealth("file:///not-a-target"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Docker packaging uses standalone admin source with certificate mounts", async () => {
  const docker = await readFile(
    new URL("../deploy/docker/Dockerfile", import.meta.url),
    "utf8",
  );
  const compose = await readFile(
    new URL("../deploy/docker/compose.yaml", import.meta.url),
    "utf8",
  );
  const contextIgnore = await readFile(
    new URL("../.dockerignore", import.meta.url),
    "utf8",
  );
  for (const directory of ["releases", ".agents"])
    assert.ok(
      contextIgnore.split(/\r?\n/).includes(directory),
      `${directory} must stay outside the Docker build context`,
    );
  assert.equal(/COPY (?:apps|packages)(?:\/|\s)/.test(docker), false);
  assert.ok(docker.includes("COPY src ./src"));
  assert.ok(docker.includes("COPY public ./public"));
  assert.ok(docker.includes("/app/releases/${VITE_RELEASE_ID}/public/"));
  assert.ok(docker.includes("npm ci"));
  assert.ok(docker.includes("validate-deployment-env.mjs"));
  assert.ok(docker.includes("--cacert"));
  assert.ok(compose.includes("./tls:/etc/kernel-admin/tls:ro"));
  assert.ok(compose.includes("read_only: true"));
});
