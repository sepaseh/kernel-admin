import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { test } from "node:test";

import { fixture } from "./docker-smoke-resources.test-support.mjs";

const importEffects = [];

const originalMkdtemp = fs.promises.mkdtemp;

const originalSpawn = childProcess.spawn;

const originalGet = https.get;

let smoke;

try {
  for (const [owner, key] of [
    [fs.promises, "mkdtemp"],
    [childProcess, "spawn"],
    [https, "get"],
  ])
    owner[key] = () => {
      importEffects.push(key);
      throw new Error(`Unexpected import side effect: ${key}`);
    };
  syncBuiltinESMExports();
  smoke = await import("./test-docker-release.mjs");
} finally {
  fs.promises.mkdtemp = originalMkdtemp;
  childProcess.spawn = originalSpawn;
  https.get = originalGet;
  syncBuiltinESMExports();
}

test("importing Docker smoke helpers creates no directory, command or request", () => {
  assert.deepEqual(importEffects, []);
});

const orchestrationFixture = async (options = {}) => {
  const owned = await fixture(options);
  const requests = [],
    messages = [];
  const headers = {
    "cache-control": "no-store",
    "content-security-policy":
      options.policy ??
      "default-src 'self'; connect-src https://api.example.com",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
  const run = () =>
    smoke.runDockerSmoke({
      identity: owned.identity,
      directory: owned.directory,
      docker: owned.docker,
      signals: owned.signals,
      readCertificate: async (filename) => {
        assert.equal(filename, path.join(owned.directory, "fullchain.pem"));
        if (options.readFailure)
          throw new Error("Synthetic certificate read failure");
        return Buffer.from("synthetic certificate");
      },
      requestFactory: ({ port, certificate, signal }) => {
        assert.equal(port, 49153);
        assert.equal(certificate.toString(), "synthetic certificate");
        return async (pathname, servername = "admin.test") => {
          signal.throwIfAborted();
          requests.push({ pathname, servername });
          if (options.interrupt) {
            owned.signals.emit(options.interrupt);
            signal.throwIfAborted();
          }
          if (servername !== "admin.test")
            throw new Error("Synthetic ECONNRESET");
          if (pathname === "/console/auth/register") {
            if (options.documentUnavailable) return { status: 503 };
            return {
              status: 200,
              headers,
              body: '<html><script src="/console/assets/app.js"></script></html>',
            };
          }
          if (pathname === "/console/_kernel/release")
            return {
              status: 200,
              headers: {
                ...headers,
                "content-security-policy":
                  options.metadataPolicy ?? headers["content-security-policy"],
              },
              body: JSON.stringify({ release: owned.identity }),
            };
          if (pathname === "/console/assets/app.js")
            return {
              status: 200,
              headers: { "cache-control": "public, immutable" },
              body: "export default 1;",
            };
          return { status: 404, headers, body: "Missing synthetic asset" };
        };
      },
      logger: {
        info: (message) => messages.push(message),
        error: (message) => messages.push(message),
      },
    });
  return { ...owned, requests, messages, run };
};

test("synthetic Docker orchestration awaits the mapped port and checks its owned fixture", async () => {
  const fixtureValue = await orchestrationFixture({
    starting: true,
  });
  await fixtureValue.run();
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  const events = fixtureValue.attempts.find((attempt) =>
    attempt.startsWith("events "),
  );
  assert.match(events, /--since \S+ --filter type=container/);
  assert.ok(events.includes(`--filter container=${fixtureValue.identity}`));
  assert.equal(
    fixtureValue.attempts.filter((attempt) => attempt.startsWith("inspect "))
      .length,
    1,
  );
  const certificateGenerator = fixtureValue.attempts.find((attempt) =>
    attempt.startsWith("run --rm --user 0:0 --read-only"),
  );
  assert.ok(
    certificateGenerator.includes("chown nginx:nginx /tls/privkey.pem"),
  );
  assert.ok(certificateGenerator.includes("chmod 640 /tls/privkey.pem"));
  assert.ok(certificateGenerator.includes("chmod 644 /tls/fullchain.pem"));
  const serving = fixtureValue.attempts.find((attempt) =>
    attempt.startsWith("run -d"),
  );
  assert.ok(serving.includes("--read-only --tmpfs /tmp --cap-drop ALL"));
  assert.ok(serving.includes("127.0.0.1::8443"));
  assert.equal(serving.includes("--user 0"), false);
  assert.ok(
    fixtureValue.attempts.includes(`port ${fixtureValue.identity} 8443/tcp`),
  );
  assert.ok(
    fixtureValue.requests.some(
      ({ servername }) => servername === "unknown.test",
    ),
  );
  assert.ok(
    fixtureValue.requests.some(
      ({ pathname }) => pathname === "/console/.env.local",
    ),
  );
  assert.match(fixtureValue.messages[0], /readiness passed/);
  await fixtureValue.cleaned();
});

test("mapped Docker ports require a single numeric loopback endpoint", () => {
  assert.equal(smoke.parseMappedPort("127.0.0.1:1\n"), 1);
  assert.equal(smoke.parseMappedPort("127.0.0.1:65535\r\n"), 65535);
  for (const value of [
    undefined,
    "",
    "127.0.0.1:0",
    "127.0.0.1:65536",
    "127.0.0.1:1.5",
    "127.0.0.1:NaN",
    "0.0.0.0:443",
    "443",
    "127.0.0.1:443\n127.0.0.1:444",
  ])
    assert.throws(
      () => smoke.parseMappedPort(value),
      /valid loopback HTTPS port/,
    );
});

for (const policy of [
  "",
  "connect-src https://api.example.com.attacker.test",
  "connect-src https://api.example.com@attacker.test",
  "connect-src https://attacker.test/https://api.example.com",
  "connect-src 'self'; img-src https://api.example.com",
  "connect-src 'self'; connect-src https://api.example.com",
  "connect-src https://api.example.com, connect-src 'self'",
])
  test(`Docker smoke rejects a CSP without an effective exact API origin: ${JSON.stringify(policy)}`, async () => {
    const fixtureValue = await orchestrationFixture({ policy });
    await assert.rejects(fixtureValue.run(), /CSP connect-src/);
    assert.equal(
      fixtureValue.requests.some(({ pathname }) => pathname.endsWith(".js")),
      false,
    );
    await fixtureValue.cleaned();
  });

test("Docker smoke verifies the CSP on the release metadata response too", async () => {
  const fixtureValue = await orchestrationFixture({
    metadataPolicy: "connect-src https://api.example.com.attacker.test",
  });
  await assert.rejects(fixtureValue.run(), /CSP connect-src/);
  await fixtureValue.cleaned();
});

const failureMessages = (error) =>
  error instanceof AggregateError
    ? error.errors.flatMap(failureMessages)
    : [String(error?.message ?? error)];

for (const [option, message] of [
  ["createFailure", /builder creation failure/],
  ["buildFailure", /image build failure/],
  ["certificateFailure", /certificate creation failure/],
  ["startFailure", /container start failure/],
  ["readFailure", /certificate read failure/],
  ["unhealthy", /not healthy/],
  ["containerExit", /exited before readiness/],
  ["eventFailure", /Docker event failure/],
  ["eventClose", /event stream closed before readiness/],
  ["documentUnavailable", /503/],
])
  test(`synthetic Docker ${option} preserves its failure and cleans every owned resource`, async () => {
    const fixtureValue = await orchestrationFixture({ [option]: true });
    await assert.rejects(fixtureValue.run(), message);
    if (option === "unhealthy") {
      assert.equal(
        fixtureValue.attempts.filter((attempt) =>
          attempt.startsWith("inspect "),
        ).length,
        1,
      );
    }
    if (option === "documentUnavailable") {
      assert.equal(fixtureValue.requests.length, 1);
    }
    assert.deepEqual(fixtureValue.state, {
      builder: false,
      image: false,
      container: false,
    });
    await fixtureValue.cleaned();
  });

test("an invalid asynchronous published port fails before any TLS request and still cleans up", async () => {
  const fixtureValue = await orchestrationFixture({
    port: "127.0.0.1:70000\n",
  });
  await assert.rejects(fixtureValue.run(), /valid loopback HTTPS port/);
  assert.deepEqual(fixtureValue.requests, []);
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  await fixtureValue.cleaned();
});

test("SIGTERM aborts synthetic orchestration without aborting owned cleanup", async () => {
  const fixtureValue = await orchestrationFixture({ interrupt: "SIGTERM" });
  await assert.rejects(fixtureValue.run(), (error) =>
    failureMessages(error).some((message) => message.includes("SIGTERM")),
  );
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  await fixtureValue.cleaned();
});

test("diagnostic and every cleanup error remain available alongside the primary failure", async () => {
  const fixtureValue = await orchestrationFixture({
    readFailure: true,
    logFailure: true,
    removalFailure: true,
    builderRemovalFailure: true,
    imageRemovalFailure: true,
  });
  await assert.rejects(fixtureValue.run(), (error) => {
    assert.ok(error instanceof AggregateError);
    const messages = failureMessages(error);
    for (const message of [
      "certificate read failure",
      "diagnostic failure",
      "container removal failure",
      "builder removal failure",
      "image removal failure",
    ])
      assert.ok(
        messages.some((actual) => actual.includes(message)),
        message,
      );
    return true;
  });
  for (const operation of ["container rm", "buildx rm", "image rm"])
    assert.ok(
      fixtureValue.attempts.some((attempt) => attempt.startsWith(operation)),
      operation,
    );
  await fixtureValue.cleaned();
});

const childFixture = () => {
  const child = new EventEmitter();
  child.pid = 123;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdout.setEncoding = child.stderr.setEncoding = () => {};
  return child;
};

const readinessFixture = ({ holdClose = false } = {}) => {
  const controller = new AbortController();
  const started = Promise.withResolvers();
  const stopped = Promise.withResolvers();
  const output = Promise.withResolvers();
  let receive;
  const identity = "kernel-admin-smoke-readiness-test";
  const docker = async (args, { signal, onStdout } = {}) => {
    if (args[0] === "inspect")
      return JSON.stringify({
        Running: true,
        StartedAt: "2026-01-01T00:00:00Z",
        Health: { Status: "starting" },
      });
    assert.equal(args[0], "events");
    assert.equal(args[2], "2026-01-01T00:00:00Z");
    receive = onStdout;
    const abort = () => {
      stopped.resolve();
      if (!holdClose) output.reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    started.resolve();
    try {
      return await output.promise;
    } finally {
      signal.removeEventListener("abort", abort);
    }
  };
  return {
    controller,
    started: started.promise,
    stopped: stopped.promise,
    close: () => output.resolve(""),
    fail: (error) => output.reject(error),
    emit: (action) => {
      const event = JSON.stringify({
        Type: "container",
        Action: action,
        Actor: { Attributes: { name: identity } },
      });
      receive(event.slice(0, 10));
      receive(event.slice(10) + "\n");
    },
    run: () =>
      smoke.waitForContainerHealth({
        docker,
        identity,
        signal: controller.signal,
      }),
  };
};

test("Docker readiness waits for fragmented health events and actual observer closure", async () => {
  const fixtureValue = readinessFixture({ holdClose: true });
  let finished = false;
  const pending = fixtureValue.run().then(() => {
    finished = true;
  });
  await fixtureValue.started;
  fixtureValue.emit("health_status: healthy");
  await fixtureValue.stopped;
  assert.equal(finished, false);
  fixtureValue.close();
  await pending;
  assert.equal(finished, true);
});

for (const [action, expected] of [
  ["health_status: unhealthy", /became unhealthy/],
  ["die", /stopped before readiness: die/],
])
  test(`Docker readiness rejects ${action} and closes observation`, async () => {
    const fixtureValue = readinessFixture();
    const rejected = assert.rejects(fixtureValue.run(), expected);
    await fixtureValue.started;
    fixtureValue.emit(action);
    await rejected;
    await fixtureValue.stopped;
  });

test("Docker readiness propagates cancellation and closes its observer", async () => {
  const fixtureValue = readinessFixture();
  const reason = new Error("Synthetic readiness cancellation");
  const rejected = assert.rejects(
    fixtureValue.run(),
    (error) => error === reason,
  );
  await fixtureValue.started;
  fixtureValue.controller.abort(reason);
  await rejected;
  await fixtureValue.stopped;
});

test("Docker readiness preserves stream failure while the container is starting", async () => {
  const fixtureValue = readinessFixture();
  const reason = new Error("Synthetic observer failure");
  const rejected = assert.rejects(
    fixtureValue.run(),
    (error) => error === reason,
  );
  await fixtureValue.started;
  fixtureValue.fail(reason);
  await rejected;
});

test("Docker driver waits for output closure after process exit", async () => {
  const child = childFixture();
  const driver = smoke.createDockerDriver({
    identity: "kernel-admin-smoke-driver-test",
    engine: "synthetic-engine",
    environment: {},
    spawnCommand: () => child,
  });
  let finished = false;
  const pending = driver(["inspect"]).then((value) => {
    finished = true;
    return value;
  });
  child.emit("exit", 0);
  await Promise.resolve();
  assert.equal(finished, false);
  child.stdout.emit("data", "complete output");
  child.emit("close", 0);
  assert.equal(await pending, "complete output");
});

test("Docker command driver forwards only explicit options and its owned builder", async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const driver = smoke.createDockerDriver({
    identity: "kernel-admin-smoke-driver-test",
    engine: "synthetic-engine",
    environment: { TEST_MODE: "synthetic" },
    repositoryRoot: "/synthetic-admin",
    spawnCommand: (program, args, options) => {
      calls.push({ program, args, options });
      const child = childFixture();
      queueMicrotask(() => {
        child.stdout.emit("data", "first");
        child.stdout.emit("data", "second");
        child.emit("close", 0);
      });
      return child;
    },
  });
  assert.equal(await driver(["buildx", "create"], { signal }), "firstsecond");
  assert.equal(await driver(["buildx", "build"]), "firstsecond");
  assert.equal(calls[0].program, "docker");
  assert.deepEqual(calls[0].args, [
    "--host",
    "synthetic-engine",
    "buildx",
    "create",
  ]);
  assert.deepEqual(calls[0].options.env, { TEST_MODE: "synthetic" });
  assert.equal(calls[0].options.signal, signal);
  assert.equal(calls[0].options.cwd, "/synthetic-admin");
  assert.equal(calls[0].options.windowsHide, true);
  assert.equal(Object.hasOwn(calls[0].options, "timeout"), false);
  assert.equal(
    calls[1].options.env.BUILDX_BUILDER,
    "kernel-admin-smoke-driver-test-builder",
  );
});

for (const [name, emit, expected] of [
  [
    "nonzero exit",
    (child) => {
      child.stderr.emit("data", "synthetic stderr");
      child.emit("close", 2);
    },
    /2.*synthetic stderr/,
  ],
  ["signal exit", (child) => child.emit("close", null, "SIGTERM"), /SIGTERM/],
  [
    "spawn error without a process",
    (child) => {
      child.pid = 0;
      child.emit("error", new Error("synthetic spawn failure"));
      child.emit("close", 1);
    },
    /synthetic spawn failure/,
  ],
  [
    "running process error",
    (child) => {
      child.emit("error", new Error("synthetic running failure"));
      child.emit("close", 1);
    },
    /synthetic running failure/,
  ],
])
  test(`Docker driver preserves ${name}`, async () => {
    const driver = smoke.createDockerDriver({
      identity: "kernel-admin-smoke-driver-test",
      engine: "synthetic-engine",
      environment: {},
      spawnCommand: () => {
        const child = childFixture();
        queueMicrotask(() => emit(child));
        return child;
      },
    });
    await assert.rejects(driver(["inspect"]), expected);
  });

test("Docker driver reports synchronous spawn failure without running another command", async () => {
  const driver = smoke.createDockerDriver({
    identity: "kernel-admin-smoke-driver-test",
    engine: "synthetic-engine",
    environment: {},
    spawnCommand: () => {
      throw new Error("synthetic unavailable command");
    },
  });
  await assert.rejects(driver(["inspect"]), /synthetic unavailable command/);
});

const tlsFixture = (mode = "success") => {
  let options;
  const identityChecks = [];
  const controller = new AbortController();
  const signal = controller.signal;
  const certificate = Buffer.from("synthetic certificate");
  const request = smoke.createTlsRequest({
    port: 49153,
    certificate,
    signal,
    verifyServerIdentity: (hostname, peerCertificate) => {
      identityChecks.push({ hostname, peerCertificate });
      return undefined;
    },
    transport: {
      get: (settings, receive) => {
        options = settings;
        const operation = new EventEmitter();
        operation.destroy = (error) => operation.emit("error", error);
        queueMicrotask(() => {
          if (mode === "request-error") {
            operation.emit("error", new Error("synthetic request failure"));
            return;
          }
          if (mode === "request-close") {
            operation.emit("close");
            return;
          }
          if (mode === "abort") {
            controller.abort(new Error("Synthetic request cancellation"));
            return;
          }
          const response = new EventEmitter();
          response.statusCode = 200;
          response.headers = { "x-synthetic": "yes" };
          response.setEncoding = (value) => assert.equal(value, "utf8");
          receive(response);
          if (mode === "response-error")
            response.emit("error", new Error("synthetic response failure"));
          else if (mode === "response-abort") response.emit("aborted");
          else if (mode === "response-close") response.emit("close");
          else {
            response.emit("data", "first");
            response.emit("data", "second");
            response.emit("end");
          }
        });
        return operation;
      },
    },
  });
  return {
    request,
    options: () => options,
    signal,
    identityChecks,
  };
};

test("TLS fixture driver uses pinned loopback, certificate, hostname and cancellation", async () => {
  const fixtureValue = tlsFixture();
  assert.deepEqual(await fixtureValue.request("/console/"), {
    status: 200,
    headers: { "x-synthetic": "yes" },
    body: "firstsecond",
  });
  assert.equal(fixtureValue.options().hostname, "127.0.0.1");
  assert.equal(fixtureValue.options().servername, "admin.test");
  assert.equal(fixtureValue.options().port, 49153);
  assert.equal(fixtureValue.options().agent, false);
  assert.equal(fixtureValue.options().rejectUnauthorized, true);
  assert.equal(Object.hasOwn(fixtureValue.options(), "ca"), false);
  const secureContext = fixtureValue.options().secureContext;
  assert.ok(secureContext);
  assert.equal(fixtureValue.options().signal, fixtureValue.signal);
  assert.equal(Object.hasOwn(fixtureValue.options(), "timeout"), false);
  assert.equal(fixtureValue.options().checkServerIdentity, undefined);
  await fixtureValue.request("/", "unknown.test");
  assert.equal(fixtureValue.options().secureContext, secureContext);
  assert.equal(fixtureValue.options().headers.Host, "unknown.test");
  const peerCertificate = { subject: { CN: "admin.test" } };
  assert.equal(
    fixtureValue.options().checkServerIdentity("unknown.test", peerCertificate),
    undefined,
  );
  assert.deepEqual(fixtureValue.identityChecks, [
    { hostname: "admin.test", peerCertificate },
  ]);
});

for (const [mode, expected] of [
  ["request-error", /synthetic request failure/],
  ["request-close", /request closed before completion/],
  ["response-error", /synthetic response failure/],
  ["response-abort", /response was aborted/],
  ["abort", /Synthetic request cancellation/],
  ["response-close", /response closed before completion/],
])
  test(`TLS fixture driver preserves ${mode}`, async () => {
    const fixtureValue = tlsFixture(mode);
    await assert.rejects(fixtureValue.request("/"), expected);
  });
