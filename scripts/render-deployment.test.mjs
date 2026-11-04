import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { environment } from "./deployment.test-support.mjs";
import { renderDeploymentTemplate } from "./render-deployment.mjs";

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
    assert.ok(
      rendered.includes('map "$status:$uri" $kernel_admin_cache_control'),
    );
    assert.ok(rendered.includes(`~^(?:200|206|304):${basePath}assets/`));
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
