import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

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

test("renderer normalizes mixed-case DNS names without accepting malformed or non-string hosts", () => {
  const template = "server_name ${ADMIN_HOST};";
  const configured = { ...environment, ADMIN_HOST: "Admin.Example.COM" };
  assert.equal(
    renderDeploymentTemplate(template, configured),
    "server_name admin.example.com;",
  );
  assert.equal(configured.ADMIN_HOST, "Admin.Example.COM");
  for (const host of [
    undefined,
    null,
    123,
    true,
    ["admin.example.com"],
    {},
    "",
    " host.example",
    "host.example ",
    "https://host.example",
    "host.example:443",
    "host..example",
    "-host.example",
    "host-.example",
    "host.example;bad",
    "a".repeat(64) + ".example",
  ])
    assert.throws(
      () =>
        renderDeploymentTemplate(template, {
          ...environment,
          ADMIN_HOST: host,
        }),
      /bare DNS hostname/,
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
    await assert.rejects(checkHealth(null));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("readiness binds deep routes to an explicit same-origin application base before requests", async (context) => {
  const requests = [];
  const bases = ["/console/", "/team/admin/", "/"];
  const server = createServer((request, response) => {
    requests.push({ path: request.url, host: request.headers.host });
    if (bases.some((base) => request.url === `${base}_kernel/release`)) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ release: "synthetic-v1" }));
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end("<html>synthetic route</html>");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const [route, base] of [
      ["/console/auth/register", "/console/"],
      ["/console/auth/", "/console/"],
      ["/team/admin/users/42", "/team/admin/"],
      ["/auth/register", "/"],
      ["/console/", undefined],
    ]) {
      const before = requests.length;
      await checkHealth(`${origin}${route}`, "synthetic-v1", base);
      assert.deepEqual(requests.slice(before), [
        { path: route, host: new URL(origin).host },
        { path: `${base ?? route}_kernel/release`, host: new URL(origin).host },
      ]);
    }
    const beforeInvalid = requests.length;
    await assert.rejects(
      checkHealth(`${origin}/console/auth/register`, "synthetic-v1"),
      /Base path/,
    );
    await assert.rejects(
      checkHealth(
        `${origin}/console-other/auth/register`,
        "synthetic-v1",
        "/console/",
      ),
      /application base/,
    );
    await assert.rejects(
      checkHealth(
        `${origin.replace("://", "://user:pass@")}/console/`,
        "synthetic-v1",
        "/console/",
      ),
      /Readiness target/,
    );
    for (const suffix of ["?probe=1", "#client"])
      await assert.rejects(
        checkHealth(
          `${origin}/console/auth/register${suffix}`,
          "synthetic-v1",
          "/console/",
        ),
        /Readiness target/,
      );
    for (const base of [
      "/console",
      "/../",
      "//elsewhere.test/",
      "https://elsewhere.test/",
      "/console/?probe=1",
    ])
      await assert.rejects(
        checkHealth(`${origin}/console/auth/register`, "synthetic-v1", base),
        /Base path/,
      );
    assert.equal(requests.length, beforeInvalid);

    const defaults = [];
    context.mock.method(globalThis, "fetch", async (target) => {
      defaults.push(target.href);
      return new Response("<html>synthetic default</html>", {
        headers: { "Content-Type": "text/html" },
      });
    });
    await checkHealth();
    await assert.rejects(checkHealth(null));
    assert.deepEqual(defaults, ["http://127.0.0.1/"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("renderer CLI confines relative inputs and exclusive output to its ordinary working tree", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "kernel-admin-renderer-"),
  );
  const root = path.join(directory, "workspace");
  const outside = path.join(directory, "outside");
  const renderer = fileURLToPath(
    new URL("./render-deployment.mjs", import.meta.url),
  );
  const execute = (patch = {}) =>
    spawnSync(
      process.execPath,
      [
        renderer,
        "--template",
        patch.template ?? "input/admin.conf.template",
        "--config-file",
        patch.environment ?? "input/public.env",
        "--output",
        patch.output ?? "output/admin.conf",
      ],
      { cwd: root, encoding: "utf8" },
    );
  try {
    await mkdir(path.join(root, "input"), { recursive: true });
    await mkdir(outside);
    await writeFile(
      path.join(root, "input/admin.conf.template"),
      "server_name ${ADMIN_HOST};",
    );
    const publicConfiguration = Object.entries(environment)
      .map(([name, value]) => `${name}=${value}`)
      .join("\n");
    await writeFile(path.join(root, "input/public.env"), publicConfiguration);
    await writeFile(path.join(outside, "public.env"), publicConfiguration);
    await writeFile(
      path.join(outside, "admin.conf.template"),
      "server_name ${ADMIN_HOST};",
    );
    await writeFile(path.join(outside, "existing.conf"), "outside sentinel");

    const result = execute();
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(path.join(root, "output/admin.conf"), "utf8"),
      "server_name admin.example.com;",
    );
    assert.notEqual(
      execute().status,
      0,
      "existing output must never be overwritten",
    );
    let attempt = 0;
    const outsideNames = {
      template: "admin.conf.template",
      environment: "public.env",
      output: "new-output.conf",
    };
    for (const field of ["template", "environment", "output"])
      for (const value of [
        `../outside/${outsideNames[field]}`,
        path.join(outside, outsideNames[field]),
        "input/../existing.conf",
        "input\\existing.conf",
        "NUL",
        "input//admin.conf",
      ]) {
        const rejection = execute({
          output: `output/rejected-${attempt++}.conf`,
          [field]: value,
        });
        assert.notEqual(rejection.status, 0, `${field}: ${value}`);
        assert.match(rejection.stderr, /Renderer paths/);
      }
    await assert.rejects(readFile(path.join(outside, "new-output.conf")), {
      code: "ENOENT",
    });
    assert.equal(
      await readFile(path.join(outside, "existing.conf"), "utf8"),
      "outside sentinel",
    );

    await symlink(
      outside,
      path.join(root, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    for (const field of ["template", "environment", "output"]) {
      const rejection = execute({
        output: `output/rejected-${attempt++}.conf`,
        [field]: `linked/${outsideNames[field]}`,
      });
      assert.notEqual(rejection.status, 0, `linked ${field}`);
      assert.match(rejection.stderr, /Renderer paths/);
    }
    await assert.rejects(readFile(path.join(outside, "new-output.conf")), {
      code: "ENOENT",
    });
    assert.equal(
      await readFile(path.join(outside, "existing.conf"), "utf8"),
      "outside sentinel",
    );
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("kernel-admin-renderer-"));
    await rm(directory, { recursive: true, force: true });
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
  assert.ok(docker.includes("npm ci --ignore-scripts"));
  assert.ok(docker.includes("validate-deployment-env.mjs"));
  assert.ok(docker.includes("--cacert"));
  assert.ok(compose.includes("./tls:/etc/kernel-admin/tls:ro"));
  assert.match(docker, /^USER nginx$/m);
  assert.match(docker, /^EXPOSE 8080 8443$/m);
  assert.match(docker, /pid \/tmp\/nginx\.pid;/);
  for (const temporary of ["client_body", "proxy", "fastcgi", "uwsgi", "scgi"])
    assert.match(docker, new RegExp(`${temporary}_temp_path /tmp/`));
  const service = parseYaml(compose).services.admin;
  assert.equal(service.read_only, true);
  assert.deepEqual(service.ports, [
    "${HTTP_PORT:-80}:8080",
    "${HTTPS_PORT:-443}:8443",
  ]);
  assert.deepEqual(service.tmpfs, ["/tmp"]);
  assert.deepEqual(service.cap_drop, ["ALL"]);
});
