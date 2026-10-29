import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runVisual, runVisualChild } from "./run-visual.mjs";
import {
  acquireVisualLock,
  assertReviewedVisualBaseline,
  assertVisualMode,
  assertVisualPortsAvailable,
  inspectVisualBrowser,
  markVisualBaselinePending,
  visualEnvironment,
} from "./visual-environment.mjs";

test("a failed snapshot update leaves pending review and a metadata failure prevents capture", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "kernel-visual-review-test-"),
  );
  const metadataPath = path.join(directory, "metadata.json");
  const imagePath = path.join(directory, "synthetic.png");
  const reviewed = {
    platform: "win32",
    playwright: "synthetic-version",
    browserVersion: "synthetic-browser",
    review: {
      status: "reviewed",
      reviewer: "Synthetic reviewer",
      reviewedAt: "2026-01-15T12:00:00Z",
    },
  };
  try {
    await writeFile(metadataPath, JSON.stringify(reviewed));
    await writeFile(imagePath, "previous synthetic pixels");
    await assert.rejects(async () => {
      await markVisualBaselinePending(metadataPath, reviewed);
      // Model Playwright replacing an earlier image before a later capture fails.
      await writeFile(imagePath, "new unreviewed synthetic pixels");
      throw new Error("Synthetic later capture failure");
    }, /Synthetic later capture failure/);
    assert.equal(
      await readFile(imagePath, "utf8"),
      "new unreviewed synthetic pixels",
    );
    const pending = JSON.parse(await readFile(metadataPath, "utf8"));
    assert.deepEqual(pending.review, {
      status: "pending",
      reviewer: null,
      reviewedAt: null,
    });
    assert.throws(
      () => assertReviewedVisualBaseline(pending, reviewed),
      /review metadata mismatch/,
    );

    const unwritable = path.join(
      directory,
      "directory-instead-of-metadata.json",
    );
    await mkdir(unwritable);
    let captureStarted = false;
    await assert.rejects(async () => {
      await markVisualBaselinePending(unwritable, reviewed);
      captureStarted = true;
    });
    assert.equal(captureStarted, false);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.equal(
      path.basename(directory).startsWith("kernel-visual-review-test-"),
      true,
    );
    await rm(directory, { recursive: true, force: true });
  }
});

test("visual run lock excludes a concurrent runner and releases for the next one", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "kernel-visual-lock-test-"),
  );
  try {
    const release = await acquireVisualLock(directory);
    try {
      await assert.rejects(acquireVisualLock(directory), /Another visual run/);
    } finally {
      await release();
    }
    const releaseNext = await acquireVisualLock(directory);
    await releaseNext();
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.equal(
      path.basename(directory).startsWith("kernel-visual-lock-test-"),
      true,
    );
    await rm(directory, { recursive: true, force: true });
  }
});

test("visual child environment rejects inherited services, credentials and build overrides", () => {
  const environment = visualEnvironment({
    PATH: "synthetic-bin",
    SystemRoot: "synthetic-os",
    API_BASE_URL: "https://owner.invalid",
    DATABASE_URL: "owner-db",
    BETTER_AUTH_SECRET: "owner-secret",
    VITE_API_BASE_URL: "https://owner.invalid",
    VITE_OBSERVABILITY_URL: "https://owner.invalid",
    WEBSITE_SKIP_BUILD: "1",
    NODE_OPTIONS: "--inspect",
    DOCKER_HOST: "tcp://owner.invalid",
    KERNEL_VISUAL_RUNNER: "wrong",
  });
  assert.equal(environment.VITE_API_BASE_URL, "https://api.example.com");
  assert.equal(Object.hasOwn(environment, "WEBSITE_SKIP_BUILD"), false);
  assert.equal(environment.KERNEL_SYNTHETIC_ENV, "1");
  assert.equal(environment.KERNEL_VISUAL_RUNNER, "1");
  assert.equal(environment.PATH, "synthetic-bin");
  for (const key of [
    "API_BASE_URL",
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "VITE_OBSERVABILITY_URL",
    "NODE_OPTIONS",
    "DOCKER_HOST",
  ])
    assert.equal(Object.hasOwn(environment, key), false, key);
});

test("baseline updates are refused under every nonempty CI marker", () => {
  for (const ci of ["1", "true", "false"])
    assert.throws(
      () => assertVisualMode({ update: true, ci, platform: "win32" }),
      /forbidden in CI/,
    );
  assert.doesNotThrow(() =>
    assertVisualMode({ update: false, ci: "1", platform: "win32" }),
  );
  assert.doesNotThrow(() =>
    assertVisualMode({ update: true, ci: "", platform: "win32" }),
  );
});

test("unsupported platform cannot silently reuse another platform's baselines", () => {
  assert.throws(
    () => assertVisualMode({ update: false, ci: "", platform: "darwin" }),
    /No visual baseline/,
  );
});

test("comparison requires an actual review and matching platform/browser, without blocking legitimate source changes", () => {
  const metadata = {
    platform: "win32",
    playwright: "synthetic-pinned-version",
    browserVersion: "synthetic-browser-version",
    sourceFingerprint: "earlier-source-before-a-legitimate-ui-change",
    review: {
      status: "reviewed",
      reviewer: "Synthetic reviewer",
      reviewedAt: "2026-01-15T12:00:00Z",
    },
  };
  const expected = {
    platform: "win32",
    playwright: metadata.playwright,
    browserVersion: metadata.browserVersion,
  };
  assert.doesNotThrow(() => assertReviewedVisualBaseline(metadata, expected));
  for (const invalid of [
    undefined,
    { ...metadata, platform: "linux" },
    { ...metadata, playwright: "another-version" },
    { ...metadata, browserVersion: "another-browser" },
    { ...metadata, review: { ...metadata.review, status: "pending" } },
    { ...metadata, review: { ...metadata.review, reviewer: "" } },
    { ...metadata, review: { ...metadata.review, reviewedAt: null } },
  ])
    assert.throws(() => assertReviewedVisualBaseline(invalid, expected));
});

test("occupied fixture ports fail closed without contacting or reusing the service", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await assert.rejects(
      assertVisualPortsAvailable([server.address().port]),
      /already in use/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unused ephemeral port passes availability preflight", async () => {
  await assertVisualPortsAvailable([0]);
});

test("the actual update command rejects CI before inspecting baselines or starting fixtures", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./run-visual.mjs", import.meta.url)), "--update"],
    {
      env: {
        ...visualEnvironment({
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
        }),
        CI: "1",
      },
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Visual baseline updates are forbidden in CI/);
});

const syntheticVisualDrivers = (failures = {}) => {
  const events = [];
  const act = (name) => {
    events.push(name);
    if (Object.hasOwn(failures, name)) throw failures[name];
  };
  const metadata = {
    platform: "win32",
    playwright: "synthetic-version",
    browserVersion: "synthetic-browser",
    review: { status: "pending", reviewer: null, reviewedAt: null },
  };
  return {
    events,
    drivers: {
      runtime: async () => {
        act("runtime");
        return { playwright: metadata.playwright };
      },
      baseline: async () => {
        act("baseline");
        return {
          ...metadata,
          review: {
            status: "reviewed",
            reviewer: "Synthetic human",
            reviewedAt: "2026-01-15T12:00:00Z",
          },
        };
      },
      lock: async () => {
        act("lock");
        return async () => act("release");
      },
      ports: async () => act("ports"),
      browserVersion: async () => {
        act("browser");
        return metadata.browserVersion;
      },
      metadata: async () => {
        act("metadata");
        return metadata;
      },
      markPending: async () => act("pending"),
      capture: async () => {
        act("capture");
        return 0;
      },
      writeResult: async () => act("result"),
    },
  };
};

test("a visual update marks fresh captures pending before starting and never reads an old approval", async () => {
  const fixture = syntheticVisualDrivers();
  const result = await runVisual({
    update: true,
    platform: "win32",
    drivers: fixture.drivers,
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.review.status, "pending");
  assert.deepEqual(fixture.events, [
    "runtime",
    "lock",
    "ports",
    "browser",
    "metadata",
    "pending",
    "capture",
    "result",
    "release",
  ]);
});

test("comparison reads reviewed provenance without marking or overwriting baselines", async () => {
  const fixture = syntheticVisualDrivers();
  const result = await runVisual({
    platform: "win32",
    drivers: fixture.drivers,
  });
  assert.equal(result.baselineIdentity.review.status, "reviewed");
  assert.equal(result.review.status, "pending");
  assert.equal(fixture.events.includes("baseline"), true);
  assert.equal(fixture.events.includes("pending"), false);
  assert.equal(fixture.events.at(-1), "release");
});

for (const invalid of [null, false, 0, undefined, "", {}])
  test(`comparison rejects malformed baseline ${JSON.stringify(invalid)} before acquiring fixtures`, async () => {
    const fixture = syntheticVisualDrivers();
    fixture.drivers.baseline = async () => invalid;
    await assert.rejects(
      runVisual({ platform: "win32", drivers: fixture.drivers }),
      /review metadata mismatch/,
    );
    assert.equal(fixture.events.includes("lock"), false);
    assert.equal(fixture.events.includes("capture"), false);
  });

test("strict CLI comparison pins OS architecture and runtime and requires source provenance", () => {
  const metadata = {
    platform: "win32",
    arch: "x64",
    node: "v24.18.0",
    osRelease: "synthetic-os",
    playwright: "synthetic-version",
    browserVersion: "synthetic-browser",
    sourceFingerprint: "a".repeat(64),
    sourceInputs: ["src/main.tsx"],
    generatedAt: "2026-01-15T11:00:00Z",
    review: {
      status: "reviewed",
      reviewer: "Synthetic human",
      reviewedAt: "2026-01-15T12:00:00Z",
    },
  };
  const expected = {
    platform: metadata.platform,
    arch: metadata.arch,
    node: metadata.node,
    osRelease: metadata.osRelease,
    playwright: metadata.playwright,
    browserVersion: metadata.browserVersion,
    strictProvenance: true,
  };
  assert.doesNotThrow(() => assertReviewedVisualBaseline(metadata, expected));
  for (const key of ["arch", "node", "osRelease"])
    assert.throws(
      () =>
        assertReviewedVisualBaseline(
          { ...metadata, [key]: "different" },
          expected,
        ),
      /current runtime/,
    );
  for (const patch of [
    { sourceFingerprint: undefined },
    { sourceFingerprint: "invalid" },
    { sourceInputs: [] },
    { sourceInputs: ["../private"] },
    { sourceInputs: ["src/main.tsx", "src/main.tsx"] },
    { generatedAt: null },
  ])
    assert.throws(
      () => assertReviewedVisualBaseline({ ...metadata, ...patch }, expected),
      /source provenance/,
    );
  assert.doesNotThrow(() =>
    assertReviewedVisualBaseline(
      { ...metadata, sourceFingerprint: "b".repeat(64) },
      expected,
    ),
  );
});

test("visual orchestration passes strict runtime identity through before acquiring fixtures", async () => {
  const fixture = syntheticVisualDrivers();
  fixture.drivers.runtime = async () => ({
    playwright: "synthetic-version",
    arch: "x64",
    node: "v24.18.0",
    osRelease: "synthetic-os",
    strictProvenance: true,
  });
  await assert.rejects(
    runVisual({ platform: "win32", drivers: fixture.drivers }),
    /current runtime/,
  );
  assert.equal(fixture.events.includes("lock"), false);
  assert.equal(fixture.events.includes("capture"), false);
});

for (const stage of [
  "ports",
  "browser",
  "metadata",
  "pending",
  "capture",
  "result",
])
  test(`visual ${stage} failure releases its lock and preserves the original failure`, async () => {
    const failure = new Error(`synthetic ${stage}`),
      fixture = syntheticVisualDrivers({ [stage]: failure });
    await assert.rejects(
      runVisual({ update: true, platform: "win32", drivers: fixture.drivers }),
      (error) => error === failure,
    );
    assert.equal(fixture.events.at(-1), "release");
    if (stage === "pending")
      assert.equal(fixture.events.includes("capture"), false);
  });

test("visual capture and lock cleanup errors remain together", async () => {
  const primary = new Error("synthetic capture"),
    cleanup = new Error("synthetic lock release");
  const fixture = syntheticVisualDrivers({
    capture: primary,
    release: cleanup,
  });
  await assert.rejects(
    runVisual({ update: true, platform: "win32", drivers: fixture.drivers }),
    (error) => {
      assert.deepEqual(error.errors, [primary, cleanup]);
      return true;
    },
  );
});

test("CI update refuses before any injected fixture driver is called", async () => {
  const fixture = syntheticVisualDrivers();
  await assert.rejects(
    runVisual({
      update: true,
      ci: "1",
      platform: "win32",
      drivers: fixture.drivers,
    }),
    /forbidden in CI/,
  );
  assert.deepEqual(fixture.events, []);
});

test("a failed lock initialization closes and removes only its own lock", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "kernel-visual-lock-test-"),
  );
  const failure = new Error("synthetic lock write"),
    events = [];
  try {
    await assert.rejects(
      acquireVisualLock(directory, {
        openFile: async () => ({
          writeFile: async () => {
            throw failure;
          },
          close: async () => events.push("close"),
        }),
        removeFile: async (filename) => {
          assert.equal(filename, path.join(directory, ".visual-run.lock"));
          events.push("unlink");
        },
      }),
      (error) => error === failure,
    );
    assert.deepEqual(events, ["close", "unlink"]);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("browser inspection preserves both version and close failures", async () => {
  const primary = new Error("synthetic version"),
    cleanup = new Error("synthetic browser close");
  await assert.rejects(
    inspectVisualBrowser(
      async () => ({
        version: () => {
          throw primary;
        },
        close: async () => {
          throw cleanup;
        },
      }),
      {},
    ),
    (error) => {
      assert.deepEqual(error.errors, [primary, cleanup]);
      return true;
    },
  );
});

test("visual child signals target only its owned process and remove listeners after close", async () => {
  const signals = new EventEmitter(),
    child = new EventEmitter(),
    kills = [];
  child.pid = 123;
  child.kill = (signal) => kills.push(signal);
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: tmpdir(),
    spawnCommand: () => child,
    signals,
  });
  signals.emit("SIGINT");
  child.emit("close", 0);
  assert.equal(await pending, 1);
  assert.deepEqual(kills, ["SIGTERM"]);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("repeated visual interrupts retain ownership until child close", async () => {
  const child = new EventEmitter();
  const signals = new EventEmitter();
  const killed = [];
  child.kill = (signal) => killed.push(signal);
  const completion = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    signals,
  });
  signals.emit("SIGINT");
  signals.emit("SIGINT");
  signals.emit("SIGTERM");
  assert.deepEqual(killed, ["SIGTERM"]);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  assert.equal(signals.listenerCount("SIGTERM"), 1);
  child.emit("close", 0);
  assert.equal(await completion, 1);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

for (const filename of ["run-lighthouse.mjs", "run-visual.mjs"])
  test(`${filename} rejects direct use until application CLI admission`, async (context) => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "kernel-prep-cli-blocked-"),
    );
    context.after(() => rm(directory, { recursive: true, force: true }));
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(new URL(`./${filename}`, import.meta.url))],
      {
        cwd: directory,
        encoding: "utf8",
        windowsHide: true,
        timeout: 10_000,
      },
    );
    assert.equal(child.status, 1);
    assert.match(
      child.stderr,
      /CLI integration is not published in this phase/,
    );
    assert.deepEqual(await readdir(directory), []);
  });
