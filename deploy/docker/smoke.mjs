import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { checkServerIdentity } from "node:tls";
import { fileURLToPath } from "node:url";

import { withSmokeResources } from "./resources.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
export const createDockerDriver =
  ({
    identity,
    engine,
    environment,
    repositoryRoot = repository,
    spawnCommand = spawn,
  }) =>
  (args, { signal } = {}) =>
    new Promise((resolve, reject) => {
      const commandEnvironment = { ...environment };
      if (
        args[0] !== "buildx" ||
        !["create", "inspect", "ls", "rm"].includes(args[1])
      )
        commandEnvironment.BUILDX_BUILDER = `${identity}-builder`;
      const child = spawnCommand("docker", ["--host", engine, ...args], {
        cwd: repositoryRoot,
        env: commandEnvironment,
        stdio: ["ignore", "pipe", "pipe"],
        signal,
        timeout: 600_000,
        windowsHide: true,
      });
      let stdout = "",
        stderr = "",
        failure;
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", (error) => {
        failure = error;
        if (!child.pid) reject(error);
      });
      child.once("close", (code, exitSignal) => {
        if (failure) reject(failure);
        else if (code !== 0)
          reject(
            new Error(
              `Local Docker operation failed (${code ?? exitSignal}): ${stderr}`,
            ),
          );
        else resolve(stdout);
      });
    });

export const parseMappedPort = (output) => {
  const match =
    typeof output === "string"
      ? /^127\.0\.0\.1:(\d+)$/.exec(output.trim())
      : null;
  const port = Number(match?.[1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Docker must publish one valid loopback HTTPS port.");

  return port;
};

export const createTlsRequest =
  ({
    port,
    certificate,
    signal,
    transport = https,
    verifyServerIdentity = checkServerIdentity,
  }) =>
  (pathname, servername = "admin.test") =>
    new Promise((resolve, reject) => {
      const operation = transport.get(
        {
          hostname: "127.0.0.1",
          port,
          path: pathname,
          servername,
          ca: certificate,
          signal,
          ...(servername === "admin.test"
            ? {}
            : {
                checkServerIdentity: (_hostname, peerCertificate) =>
                  verifyServerIdentity("admin.test", peerCertificate),
              }),
          headers: { Host: servername },
          timeout: 5000,
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (part) => {
            body += part;
          });
          response.on("error", reject);
          response.on("end", () =>
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body,
            }),
          );
        },
      );
      operation.on("error", reject);
      operation.on("timeout", () =>
        operation.destroy(new Error("HTTP fixture timeout")),
      );
    });

const waitForDocument = async ({ request, signal, wait }, attempts = 60) => {
  signal.throwIfAborted();
  let document;
  try {
    document = await request("/console/auth/register");
  } catch {
    // The owned fixture may still be starting; abort is checked by wait.
  }
  if (document?.status === 200 || attempts === 1) return document;

  await wait(500, signal);
  return waitForDocument({ request, signal, wait }, attempts - 1);
};

const verifyFixtureResponses = async ({ request, identity, signal, wait }) => {
  const document = await waitForDocument({ request, signal, wait });
  assert.equal(document?.status, 200);
  assert.match(document.body, /<html/i);
  assert.match(document.headers["cache-control"], /no-store/);
  await assert.rejects(request("/", "unknown.test"), (error) =>
    /unrecognized name|ECONNRESET|socket hang up/i.test(error.message),
  );
  for (const response of [
    document,
    await request("/console/_kernel/release"),
  ]) {
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.ok(
      response.headers["content-security-policy"].includes(
        "https://api.example.com",
      ),
    );
  }
  const metadata = await request("/console/_kernel/release");
  assert.equal(JSON.parse(metadata.body).release, identity);
  const assetPath = document.body.match(/src="([^"\s]+\.js)"/)[1];
  const asset = await request(assetPath);
  assert.equal(asset.status, 200);
  assert.match(asset.headers["cache-control"], /immutable/);
  assert.equal((await request("/console/assets/missing.js")).status, 404);
  assert.equal((await request("/console/.env.local")).status, 404);
};

const waitForContainerHealth = async (
  { docker, identity, signal, wait },
  attempts = 45,
) => {
  signal.throwIfAborted();
  const status = await docker([
    "inspect",
    "--format",
    "{{.State.Health.Status}}",
    identity,
  ]);
  if (status.trim() === "healthy") return;
  if (attempts === 1)
    throw new Error("Container readiness never became healthy.");

  await wait(1000, signal);
  return waitForContainerHealth(
    { docker, identity, signal, wait },
    attempts - 1,
  );
};

export async function runDockerSmoke({
  identity,
  directory,
  docker,
  signals = process,
  readCertificate = readFile,
  requestFactory = createTlsRequest,
  wait = (milliseconds, signal) => sleep(milliseconds, undefined, { signal }),
  logger = console,
}) {
  const image = `${identity}:local`;
  await withSmokeResources(
    { identity, image, directory, docker, signals },
    async ({ docker, builder, signal }) => {
      let started = false;
      try {
        await docker([
          "buildx",
          "build",
          "--builder",
          builder,
          "--load",
          "--label",
          `kernel.task=${identity}`,
          "-f",
          "deploy/docker/Dockerfile",
          "-t",
          image,
          "--build-arg",
          "VITE_API_BASE_URL=https://api.example.com",
          "--build-arg",
          "VITE_APP_BASE_URL=/console/",
          "--build-arg",
          `VITE_RELEASE_ID=${identity}`,
          "--build-arg",
          "ADMIN_HOST=admin.test",
          ".",
        ]);
        await docker([
          "run",
          "--rm",
          "--user",
          "0:0",
          "--read-only",
          "--security-opt",
          "no-new-privileges=true",
          "--name",
          `${identity}-tls`,
          "--label",
          `kernel.task=${identity}`,
          "--mount",
          `type=bind,source=${directory},target=/tls`,
          "--entrypoint",
          "sh",
          image,
          "-c",
          "openssl req -x509 -newkey rsa:2048 -nodes -days 1 " +
            "-subj /CN=admin.test -addext subjectAltName=DNS:admin.test " +
            "-keyout /tls/privkey.pem -out /tls/fullchain.pem " +
            "&& chown nginx:nginx /tls/privkey.pem " +
            "&& chmod 640 /tls/privkey.pem " +
            "&& chmod 644 /tls/fullchain.pem && chmod 755 /tls",
        ]);
        await docker([
          "run",
          "-d",
          "--name",
          identity,
          "--label",
          `kernel.task=${identity}`,
          "--read-only",
          "--tmpfs",
          "/tmp",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges=true",
          "-p",
          "127.0.0.1::8443",
          "--mount",
          `type=bind,source=${directory},target=/etc/kernel-admin/tls,readonly`,
          image,
        ]);
        started = true;
        const port = parseMappedPort(
          await docker(["port", identity, "8443/tcp"]),
        );
        const certificate = await readCertificate(
          path.join(directory, "fullchain.pem"),
        );
        const request = requestFactory({ port, certificate, signal });
        await verifyFixtureResponses({ request, identity, signal, wait });
        await waitForContainerHealth({ docker, identity, signal, wait });
        logger.info(
          "Independent Docker TLS/unknown-host rejection, SPA subpath, asset caching/404, headers and immutable release readiness passed.",
        );
      } catch (error) {
        if (started) {
          try {
            logger.error(await docker(["logs", "--tail", "80", identity]));
          } catch (diagnosticError) {
            throw new AggregateError(
              [error, diagnosticError],
              "Docker smoke and diagnostic collection failed.",
              { cause: diagnosticError },
            );
          }
        }
        throw error;
      }
    },
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const identity = `kernel-admin-smoke-${Date.now()}-${process.pid}`;
  const engine =
    process.platform === "win32"
      ? "npipe:////./pipe/dockerDesktopLinuxEngine"
      : "unix:///var/run/docker.sock";
  const environment = Object.fromEntries(
    [
      "PATH",
      "Path",
      "SystemRoot",
      "WINDIR",
      "COMSPEC",
      "PATHEXT",
      "USERPROFILE",
      "APPDATA",
      "LOCALAPPDATA",
      "TEMP",
      "TMP",
      "HOME",
    ].flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]]],
    ),
  );
  const directory = await mkdtemp(path.join(tmpdir(), "kernel-admin-docker-"));
  await runDockerSmoke({
    identity,
    directory,
    docker: createDockerDriver({ identity, engine, environment }),
  });
}
