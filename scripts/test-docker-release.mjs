import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkServerIdentity } from "node:tls";
import { fileURLToPath } from "node:url";

import { withSmokeResources } from "./docker-smoke-resources.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
export const createDockerDriver =
  ({
    identity,
    engine,
    environment,
    repositoryRoot = repository,
    spawnCommand = spawn,
  }) =>
  (args, { signal, onStdout } = {}) =>
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
        windowsHide: true,
      });
      let stdout = "",
        stderr = "",
        failure;
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        if (failure) return;
        try {
          onStdout?.(chunk);
        } catch (error) {
          failure = error;
          child.kill();
        }
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.once("error", (error) => {
        failure = error;
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
      signal?.throwIfAborted();
      let ended = false;
      const fail = (error) => {
        signal?.removeEventListener("abort", abort);
        reject(error);
      };
      const abort = () => operation.destroy(signal.reason);
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
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (part) => {
            body += part;
          });
          response.once("error", fail);
          response.once("aborted", () =>
            fail(new Error("TLS fixture response was aborted.")),
          );
          response.once("close", () => {
            if (!ended)
              fail(new Error("TLS fixture response closed before completion."));
          });
          response.once("end", () => {
            ended = true;
            signal?.removeEventListener("abort", abort);
            resolve({
              status: response.statusCode,
              headers: response.headers,
              body,
            });
          });
        },
      );
      operation.once("error", fail);
      operation.once("close", () => {
        if (!ended)
          fail(new Error("TLS fixture request closed before completion."));
      });
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });

const verifyFixtureResponses = async ({ request, identity, signal }) => {
  signal.throwIfAborted();
  const document = await request("/console/auth/register");
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

export const waitForContainerHealth = async ({ docker, identity, signal }) => {
  signal.throwIfAborted();
  const state = JSON.parse(
    await docker(["inspect", "--format", "{{json .State}}", identity], {
      signal,
    }),
  );
  signal.throwIfAborted();
  if (state.Running !== true || state.Restarting === true)
    throw new Error(
      `Docker container exited before readiness (${state.ExitCode}).`,
    );
  if (state.Health?.Status === "healthy") return;
  if (state.Health?.Status !== "starting")
    throw new Error(
      `Docker container is not healthy: ${state.Health?.Status}.`,
    );
  if (
    typeof state.StartedAt !== "string" ||
    !Number.isFinite(Date.parse(state.StartedAt))
  )
    throw new Error(
      "Docker readiness requires the container's actual start time.",
    );
  const observer = new AbortController();
  const observing = AbortSignal.any([signal, observer.signal]);
  const ready = Promise.withResolvers();
  let decided = false;
  let buffered = "";
  let streamFailed = false;
  let streamFailure;
  const decide = (...failures) => {
    if (decided) return;
    decided = true;
    if (failures.length) ready.reject(failures[0]);
    else ready.resolve();
  };
  const abort = () => decide(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  const consume = (chunk) => {
    buffered += chunk;
    const lines = buffered.split("\n");
    buffered = lines.pop();
    for (const line of lines) {
      if (decided || !line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (
          event.Type !== "container" ||
          event.Actor?.Attributes?.name !== identity
        )
          throw new Error(
            "Docker readiness received an unrelated container event.",
          );
        if (event.Action === "health_status: healthy") decide();
        else if (event.Action === "health_status: unhealthy")
          decide(
            new Error("Docker container became unhealthy before readiness."),
          );
        else if (
          ["die", "destroy", "stop", "kill", "oom"].includes(event.Action)
        )
          decide(
            new Error(
              `Docker container stopped before readiness: ${event.Action}.`,
            ),
          );
      } catch (error) {
        decide(error);
      }
    }
  };
  const events = Promise.resolve()
    .then(() =>
      docker(
        [
          "events",
          "--since",
          state.StartedAt,
          "--filter",
          "type=container",
          "--filter",
          `container=${identity}`,
          "--format",
          "{{json .}}",
        ],
        { signal: observing, onStdout: consume },
      ),
    )
    .then(
      () =>
        decide(
          new Error("Docker readiness event stream closed before readiness."),
        ),
      (error) => {
        if (!(
          observer.signal.aborted &&
          (error?.name === "AbortError" || error === observer.signal.reason)
        )) {
          streamFailed = true;
          streamFailure = error;
          decide(signal.aborted ? signal.reason : error);
        }
      },
    );
  try {
    await ready.promise;
    signal.throwIfAborted();
  } finally {
    observer.abort(new Error("Docker readiness observation completed."));
    await events;
    signal.removeEventListener("abort", abort);
  }
  if (streamFailed) throw streamFailure;
};

export async function runDockerSmoke({
  identity,
  directory,
  docker,
  signals = process,
  readCertificate = readFile,
  requestFactory = createTlsRequest,
  logger = console,
}) {
  const image = `${identity}:local`;
  await withSmokeResources(
    { identity, image, directory, docker, signals },
    async ({ docker: execute, builder, signal }) => {
      let started = false;
      try {
        await execute([
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
        await execute([
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
        await execute([
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
        await waitForContainerHealth({ docker, identity, signal });
        const port = parseMappedPort(
          await execute(["port", identity, "8443/tcp"]),
        );
        const certificate = await readCertificate(
          path.join(directory, "fullchain.pem"),
        );
        const request = requestFactory({ port, certificate, signal });
        await verifyFixtureResponses({ request, identity, signal });
        logger.info(
          "Independent Docker TLS/unknown-host rejection, SPA subpath, asset caching/404, headers and immutable release readiness passed.",
        );
      } catch (error) {
        if (started) {
          try {
            logger.error(await execute(["logs", "--tail", "80", identity]));
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

export async function runDockerSmokeCli() {
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

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runDockerSmokeCli();
}
