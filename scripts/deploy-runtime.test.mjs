import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { parse } from "yaml";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const availableShell = () =>
  (process.platform === "win32"
    ? [
        "C:/Program Files/Git/bin/bash.exe",
        "C:/Program Files/Git/usr/bin/bash.exe",
      ]
    : ["/bin/sh", "/usr/bin/sh"]
  ).find(
    (shell) =>
      spawnSync(shell, ["-c", "exit 0"], {
        stdio: "ignore",
        windowsHide: true,
      }).status === 0,
  );

test("Docker build rejects uppercase ADMIN_HOST before compiling or packaging", async (context) => {
  const shell = availableShell();
  if (!shell) return context.skip("A POSIX shell is required for this check.");

  const dockerfile = await read("deploy/docker/Dockerfile");
  const build = dockerfile
    .replace(/\\\r?\n/g, "")
    .split(/\r?\n/)
    .find((line) => line.startsWith("RUN ") && line.includes("npm run build"));
  assert.ok(build, "The Docker build command must be present.");

  const run = (ADMIN_HOST) =>
    spawnSync(
      shell,
      [
        "-c",
        `node() { printf 'node %s\\n' "$*"; }
npm() { printf 'npm %s\\n' "$*"; }
${build.slice(4)}`,
      ],
      {
        encoding: "utf8",
        env: { ADMIN_HOST, VITE_RELEASE_ID: "release-test-1" },
        windowsHide: true,
      },
    );

  const lowercase = run("admin.kernel.test");
  assert.ifError(lowercase.error);
  assert.equal(lowercase.status, 0, lowercase.stderr);
  assert.deepEqual(lowercase.stdout.trim().split(/\r?\n/), [
    "node scripts/validate-deployment-env.mjs",
    "npm run build",
    "node scripts/package-release.mjs --release=release-test-1",
  ]);

  const mixedCase = run("Admin.Kernel.test");
  assert.ifError(mixedCase.error);
  assert.equal(mixedCase.status, 1);
  assert.match(
    mixedCase.stderr,
    /ADMIN_HOST must be a lowercase bare DNS hostname/,
  );
  assert.equal(mixedCase.stdout, "");
});

test("container startup rejects unsafe public configuration before starting Nginx", async (context) => {
  const shell = availableShell();
  if (!shell) return context.skip("A POSIX shell is required for this check.");

  const script = await read("deploy/docker/admin-entrypoint.sh");
  const run = (changed = {}) =>
    spawnSync(
      shell,
      [
        "-c",
        `nginx() { printf 'config:%s\\n' "$*" >&2; return "$FIXTURE_NGINX_STATUS"; }
set -- true
${script}`,
      ],
      {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          ADMIN_HOST: "admin.kernel.test",
          VITE_APP_BASE_URL: "/console/",
          VITE_RELEASE_ID: "release-test-1",
          FIXTURE_NGINX_STATUS: "0",
          ...changed,
        },
        windowsHide: true,
      },
    );
  const valid = run();
  assert.ifError(valid.error);
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(valid.stderr.trim(), "config:-t");

  for (const ADMIN_HOST of [
    "",
    "Admin.kernel.test",
    "admin.kernel.test:443",
    "admin.kernel.test/path",
    "-admin.kernel.test",
    "admin..test",
  ]) {
    const result = run({ ADMIN_HOST });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Invalid admin configuration/);
    assert.doesNotMatch(result.stderr, /config:-t/);
  }
  for (const VITE_RELEASE_ID of [
    "",
    "example-unreleased",
    "replace-release-id",
    "replace-with-immutable-release-id",
    "../release",
    "release;command",
    "a".repeat(129),
  ])
    assert.equal(run({ VITE_RELEASE_ID }).status, 1);
  for (const VITE_APP_BASE_URL of ["", "console/", "/console", "/../"])
    assert.equal(run({ VITE_APP_BASE_URL }).status, 1);
  assert.equal(run({ FIXTURE_NGINX_STATUS: "1" }).status, 1);
});

test("HTTPS readiness requires valid Nginx configuration, trusted TLS and exact release status", async (context) => {
  const shell = availableShell();
  if (!shell) return context.skip("A POSIX shell is required for this check.");

  const script = await read("deploy/docker/admin-healthcheck.sh");
  const run = (changed = {}) =>
    spawnSync(
      shell,
      [
        "-c",
        `nginx() { printf 'config:%s\\n' "$*" >&2; return "$FIXTURE_NGINX_STATUS"; }
curl() {
  printf 'curl\\n' >&2
  printf '%s\\n' "$@" >&2
  printf '%s' "$FIXTURE_RESPONSE"
  return "$FIXTURE_CURL_STATUS"
}
${script}`,
      ],
      {
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          ADMIN_HOST: "admin.kernel.test",
          VITE_APP_BASE_URL: "/console/",
          VITE_RELEASE_ID: "release-test-1",
          FIXTURE_NGINX_STATUS: "0",
          FIXTURE_CURL_STATUS: "0",
          FIXTURE_RESPONSE: '{"release":"release-test-1"}\n|200',
          ...changed,
        },
        windowsHide: true,
      },
    );
  const ready = run();
  assert.ifError(ready.error);
  assert.equal(ready.status, 0, ready.stderr);
  assert.deepEqual(ready.stderr.trim().split(/\r?\n/), [
    "config:-t",
    "curl",
    "--disable",
    "--fail",
    "--silent",
    "--show-error",
    "--noproxy",
    "*",
    "--proto",
    "=https",
    "--max-redirs",
    "0",
    "--connect-timeout",
    "2",
    "--max-time",
    "5",
    "--cacert",
    "/etc/kernel-admin/tls/fullchain.pem",
    "--resolve",
    "admin.kernel.test:8443:127.0.0.1",
    "--write-out",
    "|%{http_code}",
    "https://admin.kernel.test:8443/console/_kernel/release",
  ]);
  for (const FIXTURE_RESPONSE of [
    '{"release":"release-test-1"}\n|301',
    '{"release":"release-test-1"}\n|503',
    '{"release":"different-release"}\n|200',
    '{"release":"release-test-1","unexpected":true}\n|200',
    "not-json|200",
  ])
    assert.equal(run({ FIXTURE_RESPONSE }).status, 1);
  assert.equal(run({ FIXTURE_CURL_STATUS: "60" }).status, 60);
  assert.equal(run({ FIXTURE_CURL_STATUS: "28" }).status, 28);
  const invalidConfig = run({ FIXTURE_NGINX_STATUS: "1" });
  assert.equal(invalidConfig.status, 1);
  assert.doesNotMatch(invalidConfig.stderr, /curl/);
});

test("Compose bounds logs and refuses to create a missing TLS bind directory", async () => {
  const { services } = parse(await read("deploy/docker/compose.yaml"));
  const { admin } = services;
  assert.deepEqual(admin.logging, {
    driver: "local",
    options: { "max-size": "10m", "max-file": "3" },
  });
  assert.equal(admin.read_only, true);
  assert.deepEqual(admin.cap_drop, ["ALL"]);
  assert.deepEqual(admin.security_opt, ["no-new-privileges:true"]);
  assert.deepEqual(admin.volumes, [
    {
      type: "bind",
      source:
        "${TLS_CERT_DIRECTORY:?Set existing absolute TLS certificate directory}",
      target: "/etc/kernel-admin/tls",
      read_only: true,
      bind: { create_host_path: false },
    },
  ]);
  const dockerfile = await read("deploy/docker/Dockerfile");
  assert.match(
    dockerfile,
    /COPY deploy\/native\/nginx\/admin\.conf\.template /,
  );
  assert.doesNotMatch(dockerfile, /COPY deploy \.\/deploy/);
  assert.match(dockerfile, /USER nginx/);
  assert.match(
    dockerfile,
    /ENTRYPOINT \["\/usr\/local\/bin\/kernel-admin-entrypoint"\]/,
  );
  assert.match(dockerfile, /HEALTHCHECK[^\n]+kernel-admin-healthcheck/);
});
