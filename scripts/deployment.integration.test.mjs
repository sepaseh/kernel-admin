import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { parse as parseYaml } from "yaml";

test("Docker packaging uses standalone admin source with certificate mounts", async () => {
  const docker = await readFile(
    new URL("../deploy/docker/Dockerfile", import.meta.url),
    "utf8",
  );
  const compose = await readFile(
    new URL("../deploy/docker/compose.yaml", import.meta.url),
    "utf8",
  );
  const healthcheck = await readFile(
    new URL("../deploy/docker/admin-healthcheck.sh", import.meta.url),
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
  assert.ok(docker.includes("admin-healthcheck.sh"));
  assert.ok(healthcheck.includes("--cacert"));
  assert.match(docker, /^USER nginx$/m);
  assert.match(docker, /^EXPOSE 8080 8443$/m);
  assert.match(docker, /pid \/tmp\/nginx\.pid;/);
  for (const temporary of ["client_body", "proxy", "fastcgi", "uwsgi", "scgi"])
    assert.match(docker, new RegExp(`${temporary}_temp_path /tmp/`));
  const service = parseYaml(compose).services.admin;
  assert.equal(service.read_only, true);
  assert.deepEqual(service.volumes, [
    {
      type: "bind",
      source:
        "${TLS_CERT_DIRECTORY:?Set existing absolute TLS certificate directory}",
      target: "/etc/kernel-admin/tls",
      read_only: true,
      bind: { create_host_path: false },
    },
  ]);
  assert.deepEqual(service.ports, [
    "${BIND_ADDRESS:-0.0.0.0}:${HTTP_PORT:-80}:8080",
    "${BIND_ADDRESS:-0.0.0.0}:${HTTPS_PORT:-443}:8443",
  ]);
  assert.deepEqual(service.tmpfs, ["/tmp"]);
  assert.deepEqual(service.cap_drop, ["ALL"]);
});
