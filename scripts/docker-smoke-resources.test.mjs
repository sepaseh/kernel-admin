import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { mkdtemp, stat } from "node:fs/promises";
import https from "node:https";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { withSmokeResources } from "../deploy/docker/resources.mjs";

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
  smoke = await import("../deploy/docker/smoke.mjs");
} finally {
  fs.promises.mkdtemp = originalMkdtemp;
  childProcess.spawn = originalSpawn;
  https.get = originalGet;
  syncBuiltinESMExports();
}

async function fixture(options = {}) {
  const identity = "kernel-admin-smoke-resource-test";
  const image = `${identity}:local`;
  const directory = await mkdtemp(
    path.join(tmpdir(), "kernel-admin-docker-test-"),
  );
  const signals = new EventEmitter();
  const state = {
    builder: !!options.preexisting,
    image: !!options.preexistingImage,
    container: !!options.preexistingContainer,
  };
  const attempts = [];
  const docker = async (args, { signal } = {}) => {
    attempts.push(args.join(" "));
    signal?.throwIfAborted();
    if (args[0] === "container" && args[1] === "ls")
      return state.container ? (options.containerId ?? "aabbccddeeff\n") : "";
    if (args[0] === "image" && args[1] === "ls")
      return state.image ? "image-id\n" : "";
    if (args[0] === "buildx" && args[1] === "inspect") {
      if (options.inspectFailure)
        throw new Error("Synthetic builder metadata error");
      if (state.builder) return `${identity}-builder\n`;
      throw new Error(`ERROR: no builder "${identity}-builder" found`);
    }
    if (args[0] === "buildx" && args[1] === "create") {
      state.builder = true;
      if (options.createFailure)
        throw new Error("Synthetic builder creation failure");
      return "";
    }
    if (args[0] === "container" && args[1] === "rm") {
      if (options.removalFailure)
        throw new Error("Synthetic container removal failure");
      state.container = false;
      return "";
    }
    if (args[0] === "image" && args[1] === "rm") {
      if (options.imageRemovalFailure)
        throw new Error("Synthetic image removal failure");
      state.image = false;
      return "";
    }
    if (args[0] === "buildx" && args[1] === "rm") {
      if (options.builderRemovalFailure)
        throw new Error("Synthetic builder removal failure");
      state.builder = false;
      if (options.lateExport) state.image = true;
      return "";
    }
    if (args[0] === "wait-for-interrupt")
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        }),
      );
    if (args[0] === "buildx" && args[1] === "build") {
      state.image = true;
      if (options.buildFailure)
        throw new Error("Synthetic image build failure");
      return "built";
    }
    if (args[0] === "run") {
      if (args.includes("--rm")) {
        if (options.certificateFailure) {
          state.container = true;
          throw new Error("Synthetic certificate creation failure");
        }
      } else {
        state.container = true;
        if (options.startFailure)
          throw new Error("Synthetic container start failure");
      }
      return "aabbccddeeff";
    }
    if (args[0] === "port") return options.port ?? "127.0.0.1:49153\r\n";
    if (args[0] === "inspect")
      return options.unhealthy ? "starting\n" : "healthy\n";
    if (args[0] === "logs") {
      if (options.logFailure) throw new Error("Synthetic diagnostic failure");
      return "Synthetic container logs";
    }
    throw new Error(`Unexpected synthetic Docker operation: ${args.join(" ")}`);
  };
  const run = (body) =>
    withSmokeResources({ identity, image, directory, docker, signals }, body);
  const cleaned = async () => {
    await assert.rejects(stat(directory), { code: "ENOENT" });
    assert.equal(signals.listenerCount("SIGINT"), 0);
    assert.equal(signals.listenerCount("SIGTERM"), 0);
  };
  return {
    run,
    state,
    signals,
    attempts,
    cleaned,
    docker,
    directory,
    identity,
  };
}

test("successful Docker fixtures remove only their container, image, builder cache and temporary directory", async () => {
  const fixtureValue = await fixture();
  await fixtureValue.run(async ({ builder }) => {
    assert.match(builder, /^kernel-admin-smoke-/);
    fixtureValue.state.image = true;
    fixtureValue.state.container = true;
  });
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  assert.equal(
    fixtureValue.attempts.some((args) =>
      /prune|--use|--keep-state|buildx ls/.test(args),
    ),
    false,
  );
  assert.ok(
    fixtureValue.attempts.some((args) =>
      args.includes("--driver docker-container --driver-opt default-load=true"),
    ),
  );
  await fixtureValue.cleaned();
});

test("a failed build still deletes its dedicated builder and partial image", async () => {
  const fixtureValue = await fixture();
  await assert.rejects(
    fixtureValue.run(async () => {
      fixtureValue.state.image = true;
      throw new Error("Synthetic failed build");
    }),
    /Synthetic failed build/,
  );
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  await fixtureValue.cleaned();
});

test("one cleanup failure does not suppress the test failure or stop remaining cleanup", async () => {
  const fixtureValue = await fixture({ removalFailure: true });
  await assert.rejects(
    fixtureValue.run(async () => {
      fixtureValue.state.image = true;
      fixtureValue.state.container = true;
      throw new Error("Synthetic test failure");
    }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.match(error.errors[0].message, /Synthetic test failure/);
      assert.match(
        error.errors[1].message,
        /Synthetic container removal failure/,
      );
      return true;
    },
  );
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: true,
  });
  await fixtureValue.cleaned();
});

test("SIGINT aborts active Docker work and permits non-aborted cleanup", async () => {
  const fixtureValue = await fixture();
  await assert.rejects(
    fixtureValue.run(async ({ docker }) => {
      fixtureValue.state.image = true;
      fixtureValue.state.container = true;
      const pending = docker(["wait-for-interrupt"]);
      fixtureValue.signals.emit("SIGINT");
      await pending;
    }),
    /interrupted by SIGINT/,
  );
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  await fixtureValue.cleaned();
});

test("an existing resource name is never claimed or removed", async () => {
  const fixtureValue = await fixture({ preexisting: true });
  await assert.rejects(
    fixtureValue.run(async () => assert.fail("Body must not run")),
    /must not already exist/,
  );
  assert.equal(fixtureValue.state.builder, true);
  assert.equal(
    fixtureValue.attempts.some((args) => args.includes(" rm ")),
    false,
  );
  await fixtureValue.cleaned();
});

test("unexpected builder metadata errors fail closed without running a build", async () => {
  const fixtureValue = await fixture({ inspectFailure: true });
  await assert.rejects(
    fixtureValue.run(async () => assert.fail("Body must not run")),
    /Synthetic builder metadata error/,
  );
  assert.equal(fixtureValue.state.builder, false);
  await fixtureValue.cleaned();
});

test("a final image export during builder shutdown is still removed after a failed test", async () => {
  const fixtureValue = await fixture({ lateExport: true });
  await assert.rejects(
    fixtureValue.run(async () => {
      fixtureValue.state.container = true;
      throw new Error("Synthetic interrupted export");
    }),
    /Synthetic interrupted export/,
  );
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  await fixtureValue.cleaned();
});

test("importing Docker smoke helpers creates no directory, command or request", () => {
  assert.deepEqual(importEffects, []);
});

const orchestrationFixture = async (options = {}) => {
  const owned = await fixture(options);
  const requests = [],
    waits = [],
    messages = [];
  let documentAttempts = 0;
  const headers = {
    "cache-control": "no-store",
    "content-security-policy":
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
            documentAttempts++;
            if (options.documentUnavailable) return { status: 503 };
            if (documentAttempts <= (options.startupFailures ?? 0))
              throw new Error("Synthetic server starting");
            return {
              status: 200,
              headers,
              body: '<html><script src="/console/assets/app.js"></script></html>',
            };
          }
          if (pathname === "/console/_kernel/release")
            return {
              status: 200,
              headers,
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
      wait: async (milliseconds, signal) => {
        waits.push(milliseconds);
        signal.throwIfAborted();
      },
      logger: {
        info: (message) => messages.push(message),
        error: (message) => messages.push(message),
      },
    });
  return { ...owned, requests, waits, messages, run };
};

test("synthetic Docker orchestration awaits the mapped port and checks its owned fixture", async () => {
  const fixtureValue = await orchestrationFixture({ startupFailures: 1 });
  await fixtureValue.run();
  assert.deepEqual(fixtureValue.state, {
    builder: false,
    image: false,
    container: false,
  });
  assert.deepEqual(fixtureValue.waits, [500]);
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
  ["unhealthy", /never became healthy/],
  ["documentUnavailable", /503/],
])
  test(`synthetic Docker ${option} preserves its failure and cleans every owned resource`, async () => {
    const fixtureValue = await orchestrationFixture({ [option]: true });
    await assert.rejects(fixtureValue.run(), message);
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

test("non-Error callback rejections are preserved even when their value is undefined", async () => {
  const fixtureValue = await fixture();
  let rejected = false;
  try {
    await fixtureValue.run(async () => {
      throw undefined;
    });
  } catch (error) {
    rejected = true;
    assert.equal(error, undefined);
  }
  assert.equal(rejected, true);
  await fixtureValue.cleaned();
});

test("cleanup never passes malformed container identifiers to a removal command", async () => {
  const fixtureValue = await fixture({ containerId: "--all\n" });
  await assert.rejects(
    fixtureValue.run(async () => {
      fixtureValue.state.container = true;
      fixtureValue.state.image = true;
    }),
    AggregateError,
  );
  assert.equal(
    fixtureValue.attempts.some((attempt) => attempt.startsWith("container rm")),
    false,
  );
  assert.ok(
    fixtureValue.attempts.some((attempt) => attempt.startsWith("buildx rm")),
  );
  assert.ok(
    fixtureValue.attempts.some((attempt) => attempt.startsWith("image rm")),
  );
  await fixtureValue.cleaned();
});

for (const option of ["preexistingImage", "preexistingContainer"])
  test(`an existing ${option} is not claimed or removed`, async () => {
    const fixtureValue = await fixture({ [option]: true });
    await assert.rejects(
      fixtureValue.run(async () => assert.fail("Must not run")),
      /must not already exist/,
    );
    assert.equal(
      fixtureValue.attempts.some((attempt) =>
        /^(?:container|image|buildx) rm/.test(attempt),
      ),
      false,
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
  assert.equal(calls[0].options.timeout, 600_000);
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
  const signal = new AbortController().signal;
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
          if (mode === "timeout") {
            operation.emit("timeout");
            return;
          }
          const response = new EventEmitter();
          response.statusCode = 200;
          response.headers = { "x-synthetic": "yes" };
          response.setEncoding = (value) => assert.equal(value, "utf8");
          receive(response);
          if (mode === "response-error")
            response.emit("error", new Error("synthetic response failure"));
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
    certificate,
    signal,
    identityChecks,
  };
};

test("TLS fixture driver uses pinned loopback, certificate, hostname and timeout", async () => {
  const fixtureValue = tlsFixture();
  assert.deepEqual(await fixtureValue.request("/console/"), {
    status: 200,
    headers: { "x-synthetic": "yes" },
    body: "firstsecond",
  });
  assert.equal(fixtureValue.options().hostname, "127.0.0.1");
  assert.equal(fixtureValue.options().servername, "admin.test");
  assert.equal(fixtureValue.options().port, 49153);
  assert.equal(fixtureValue.options().ca, fixtureValue.certificate);
  assert.equal(fixtureValue.options().signal, fixtureValue.signal);
  assert.equal(fixtureValue.options().timeout, 5000);
  assert.equal(fixtureValue.options().checkServerIdentity, undefined);
  await fixtureValue.request("/", "unknown.test");
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
  ["response-error", /synthetic response failure/],
  ["timeout", /HTTP fixture timeout/],
])
  test(`TLS fixture driver preserves ${mode}`, async () => {
    const fixtureValue = tlsFixture(mode);
    await assert.rejects(fixtureValue.request("/"), expected);
  });
