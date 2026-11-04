import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertVisualBaselineImages,
  executeVisualFile,
  runVisual,
  runVisualChild,
} from "./run-visual.mjs";
import { markVisualBaselinePending } from "./visual-environment.mjs";

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
    sourceFingerprint: "a".repeat(64),
    sourceInputs: ["src/app/App.tsx"],
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
      baselineImages: async () => act("images"),
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

test("comparison verifies approved PNG bytes and inventory before any browser or child", async () => {
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "kernel-visual-image-hashes-")),
  );
  const image = path.join(directory, "approved.png");
  const bytes = Buffer.from("synthetic reviewed PNG bytes");
  const metadata = {
    images: [
      {
        name: "approved.png",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    ],
  };
  try {
    await writeFile(image, bytes);
    await assertVisualBaselineImages(directory, metadata);
    await writeFile(image, "unreviewed replacement bytes");
    const fixture = syntheticVisualDrivers();
    const baseline = fixture.drivers.baseline;
    fixture.drivers.baseline = async () => ({
      ...(await baseline()),
      ...metadata,
    });
    fixture.drivers.baselineImages = async (reviewed) => {
      fixture.events.push("images");
      await assertVisualBaselineImages(directory, reviewed);
    };
    await assert.rejects(
      runVisual({ platform: "win32", drivers: fixture.drivers }),
      /image hash mismatch/,
    );
    assert.equal(fixture.events.includes("lock"), false);
    assert.equal(fixture.events.includes("browser"), false);
    assert.equal(fixture.events.includes("capture"), false);
    await writeFile(image, bytes);
    for (const invalid of [
      {},
      { images: [] },
      { images: [metadata.images[0], metadata.images[0]] },
      {
        images: [{ name: "../private.png", sha256: metadata.images[0].sha256 }],
      },
    ])
      await assert.rejects(
        assertVisualBaselineImages(directory, invalid),
        /image hashes are required/,
      );
    await writeFile(path.join(directory, "unlisted.png"), "unreviewed image");
    await assert.rejects(
      assertVisualBaselineImages(directory, metadata),
      /image inventory mismatch/,
    );
  } finally {
    assert.equal(
      path.dirname(path.resolve(directory)),
      await realpath(tmpdir()),
    );
    assert.equal(
      path.basename(directory).startsWith("kernel-visual-image-hashes-"),
      true,
    );
    await rm(directory, { recursive: true, force: true });
  }
});

test("source edits during comparison or capture reject success and leave captures pending", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "kernel-visual-source-mutation-"),
  );
  const source = path.join(directory, "App.tsx"),
    pending = path.join(directory, "metadata.json");
  try {
    for (const update of [false, true]) {
      await writeFile(source, "synthetic source before child");
      const fixture = syntheticVisualDrivers(),
        metadata = fixture.drivers.metadata;
      fixture.drivers.metadata = async () => ({
        ...(await metadata()),
        sourceFingerprint: createHash("sha256")
          .update(await readFile(source))
          .digest("hex"),
      });
      fixture.drivers.markPending = async (value) => {
        fixture.events.push("pending");
        await markVisualBaselinePending(pending, value);
      };
      fixture.drivers.capture = async () => {
        fixture.events.push("capture");
        await writeFile(source, "synthetic source edited while child ran");
        return 0;
      };
      await assert.rejects(
        runVisual({ update, platform: "win32", drivers: fixture.drivers }),
        /Visual source changed/,
      );
      assert.equal(fixture.events.includes("capture"), true);
      assert.equal(fixture.events.includes("result"), false);
      assert.equal(fixture.events.at(-1), "release");
      if (update)
        assert.equal(
          JSON.parse(await readFile(pending, "utf8")).review.status,
          "pending",
        );
    }
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.equal(
      path.basename(directory).startsWith("kernel-visual-source-mutation-"),
      true,
    );
    await rm(directory, { recursive: true, force: true });
  }
});

test("reviewed baselines reject linked directories, ancestors and images", async () => {
  const container = await realpath(
    await mkdtemp(path.join(tmpdir(), "kernel-visual-linked-images-")),
  );
  const target = path.join(container, "target"),
    alias = path.join(container, "alias"),
    nested = path.join(target, "nested"),
    images = path.join(container, "images");
  const bytes = Buffer.from("synthetic reviewed linked image"),
    metadata = {
      images: [
        {
          name: "approved.png",
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
    };
  const linkType = process.platform === "win32" ? "junction" : "dir";
  try {
    await mkdir(nested, { recursive: true });
    await mkdir(images);
    await writeFile(path.join(target, "approved.png"), bytes);
    await writeFile(path.join(nested, "approved.png"), bytes);
    await symlink(target, alias, linkType);
    await assert.rejects(
      assertVisualBaselineImages(alias, metadata),
      /ordinary directory/,
    );
    await assert.rejects(
      assertVisualBaselineImages(path.join(alias, "nested"), metadata),
      /ordinary directory/,
    );
    await symlink(target, path.join(images, "approved.png"), linkType);
    await assert.rejects(
      assertVisualBaselineImages(images, metadata),
      /ordinary image/,
    );
  } finally {
    assert.equal(path.dirname(container), await realpath(tmpdir()));
    assert.ok(
      path.basename(container).startsWith("kernel-visual-linked-images-"),
    );
    await rm(container, { recursive: true, force: true });
  }
});

test("reviewed baselines reject an image path replaced after opening it", async (context) => {
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "kernel-visual-image-replacement-")),
  );
  const filename = path.join(directory, "approved.png");
  const image = Buffer.from("synthetic reviewed image");
  const openFile = fs.promises.open;
  let read = false;
  let closed = false;
  try {
    await writeFile(filename, image);
    context.mock.method(fs.promises, "open", async (file, flags) => {
      const handle = await openFile(file, flags);
      if (file !== filename) return handle;
      return {
        async stat(options) {
          const opened = await handle.stat(options);
          await rename(filename, path.join(directory, "previous"));
          await writeFile(filename, image);
          return opened;
        },
        async readFile() {
          read = true;
          return handle.readFile();
        },
        async close() {
          closed = true;
          await handle.close();
        },
      };
    });
    syncBuiltinESMExports();
    await assert.rejects(
      assertVisualBaselineImages(directory, {
        images: [
          {
            name: "approved.png",
            sha256: createHash("sha256").update(image).digest("hex"),
          },
        ],
      }),
      /ordinary image/,
    );
    assert.equal(read, false);
    assert.equal(closed, true);
  } finally {
    context.mock.restoreAll();
    syncBuiltinESMExports();
    assert.equal(path.dirname(directory), await realpath(tmpdir()));
    assert.ok(
      path.basename(directory).startsWith("kernel-visual-image-replacement-"),
    );
    await rm(directory, { recursive: true, force: true });
  }
});

test("comparison rejects baseline hash or inventory edits during its child before writing results", async () => {
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "kernel-visual-baseline-mutation-")),
  );
  const image = path.join(directory, "approved.png"),
    extra = path.join(directory, "unlisted.png"),
    bytes = Buffer.from("synthetic reviewed original image");
  const metadata = {
    images: [
      {
        name: "approved.png",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    ],
  };
  try {
    for (const kind of ["hash", "inventory"]) {
      await writeFile(image, bytes);
      const fixture = syntheticVisualDrivers(),
        baseline = fixture.drivers.baseline;
      fixture.drivers.baseline = async () => ({
        ...(await baseline()),
        ...metadata,
      });
      fixture.drivers.baselineImages = async (reviewed) => {
        fixture.events.push("images");
        await assertVisualBaselineImages(directory, reviewed);
      };
      fixture.drivers.capture = async () => {
        fixture.events.push("capture");
        await writeFile(
          kind === "hash" ? image : extra,
          "unreviewed image bytes",
        );
        return 0;
      };
      await assert.rejects(
        runVisual({ platform: "win32", drivers: fixture.drivers }),
        kind === "hash" ? /image hash mismatch/ : /image inventory mismatch/,
      );
      assert.equal(
        fixture.events.filter((event) => event === "images").length,
        2,
      );
      assert.equal(fixture.events.includes("capture"), true);
      assert.equal(fixture.events.includes("result"), false);
      assert.equal(fixture.events.at(-1), "release");
    }
  } finally {
    assert.equal(path.dirname(directory), await realpath(tmpdir()));
    assert.ok(
      path.basename(directory).startsWith("kernel-visual-baseline-mutation-"),
    );
    await rm(directory, { recursive: true, force: true });
  }
});

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
    "metadata",
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

for (const aborted of [false, true]) {
  test(`visual helper ${aborted ? "abort" : "success"} callback waits for actual helper close`, async () => {
    const child = new EventEmitter(),
      options = { signal: new AbortController().signal, windowsHide: true },
      failure = Object.assign(new Error("synthetic helper aborted"), {
        name: "AbortError",
        code: "ABORT_ERR",
      });
    let callback,
      settled = false;
    const pending = executeVisualFile(
      "synthetic-helper",
      ["owned-only"],
      options,
      (command, args, actualOptions, complete) => {
        assert.equal(command, "synthetic-helper");
        assert.deepEqual(args, ["owned-only"]);
        assert.equal(actualOptions, options);
        callback = complete;
        return child;
      },
    );
    const outcome = pending.then(
      (value) => {
        settled = true;
        return { value };
      },
      (error) => {
        settled = true;
        return { error };
      },
    );

    callback(
      aborted ? failure : null,
      "synthetic output",
      "synthetic diagnostic",
    );
    await new Promise(setImmediate);
    assert.equal(settled, false);
    assert.equal(child.listenerCount("close"), 1);
    child.emit("close", aborted ? 1 : 0, aborted ? "SIGTERM" : null);

    if (aborted) {
      const { error } = await outcome;
      assert.equal(error, failure);
      assert.equal(error.stdout, "synthetic output");
      assert.equal(error.stderr, "synthetic diagnostic");
    } else
      assert.deepEqual(await outcome, {
        value: {
          stdout: "synthetic output",
          stderr: "synthetic diagnostic",
        },
      });
    assert.equal(child.listenerCount("close"), 0);
  });
}

test("visual helper launch errors retain the original synchronous failure", async () => {
  const failure = new Error("synthetic helper could not launch");
  await assert.rejects(
    executeVisualFile("synthetic-helper", [], {}, () => {
      throw failure;
    }),
    (error) => error === failure,
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
    platform: "linux",
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
    platform: "linux",
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

const visualTreeSnapshot = (processId = 123) =>
  JSON.stringify({
    schemaVersion: 1,
    rootProcessId: processId,
    processes: [{ processId, parentProcessId: 1, createdAt: "1" }],
  });

test("Windows visual interrupts stop the verified process tree before the CLI", async () => {
  const signals = new EventEmitter(),
    child = new EventEmitter(),
    events = [],
    killed = Promise.withResolvers();
  child.pid = 123;
  child.kill = (signal) => {
    events.push(["kill", signal]);
    killed.resolve();
  };
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    executeFile: async (command, args, options) => {
      assert.equal(
        command,
        String.raw`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,
      );
      assert.equal(options.signal.aborted, false);
      assert.deepEqual(options.stdio, [
        args.at(-1) === "Snapshot" ? "ignore" : "pipe",
        "pipe",
        "pipe",
      ]);
      assert.equal(options.windowsHide, true);
      if (args.at(-1) === "Snapshot") {
        events.push(["snapshot"]);
        return { stdout: visualTreeSnapshot() };
      }
      assert.equal(args.at(-1), "Stop");
      assert.equal(args.includes("-SnapshotBase64"), false);
      events.push([
        "stop",
        Buffer.from(options.input, "base64").toString("utf8"),
      ]);
    },
    signals,
  });
  signals.emit("SIGINT");
  await killed.promise;
  assert.deepEqual(events, [
    ["snapshot"],
    ["stop", visualTreeSnapshot()],
    ["kill", "SIGTERM"],
  ]);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  child.emit("close", 0);
  assert.equal(await pending, 1);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("manual cancellation awaits ownership evidence and uses the supplied Windows system root", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    events = [],
    snapshot = Promise.withResolvers(),
    killed = Promise.withResolvers();
  child.pid = 321;
  child.kill = (signal) => {
    events.push(["kill", signal]);
    killed.resolve();
  };
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: { SystemRoot: String.raw`D:\Windows` },
    cwd: "synthetic-only",
    spawnCommand: (_command, _args, options) => {
      assert.equal(Object.hasOwn(options, "timeout"), false);
      return child;
    },
    platform: "win32",
    executeFile: async (command, args, options) => {
      assert.equal(Object.hasOwn(options, "timeout"), false);
      assert.equal(
        command,
        String.raw`D:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,
      );
      assert.equal(options.signal.aborted, false);
      if (args.at(-1) === "Snapshot") {
        events.push(["snapshot"]);
        assert.ok(args.includes("-StartedAfter"));
        assert.ok(args.includes("-StartedBefore"));
        return snapshot.promise;
      }
      assert.equal(args.at(-1), "Stop");
      events.push([
        "stop",
        Buffer.from(options.input, "base64").toString("utf8"),
      ]);
    },
    signals,
  });
  assert.deepEqual(events, []);
  signals.emit("SIGINT");
  assert.deepEqual(events, [["snapshot"]]);
  snapshot.resolve({ stdout: visualTreeSnapshot(321) });
  await killed.promise;
  assert.deepEqual(events, [
    ["snapshot"],
    ["stop", visualTreeSnapshot(321)],
    ["kill", "SIGTERM"],
  ]);
  child.emit("close", 0);
  assert.equal(await pending, 1);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
  signals.emit("SIGTERM");
  assert.equal(events.length, 3);
});

test("normal visual completion removes signal ownership and cannot terminate a later reused PID", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter();
  child.pid = 123;
  child.kill = () => assert.fail("The completed child is no longer owned");
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    executeFile: () => assert.fail("The completed tree is no longer owned"),
    signals,
  });
  child.emit("close", 0);
  assert.equal(await pending, 0);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
  signals.emit("SIGINT");
  signals.emit("SIGTERM");
});

test("a failed visual spawn rejects immediately and releases listeners without targeting a process", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    failure = new Error("synthetic spawn failed");
  child.kill = () => assert.fail("No child process was started");
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    executeFile: () => assert.fail("No process tree was started"),
    signals,
  });
  child.emit("error", failure);
  await assert.rejects(pending, (error) => error === failure);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
  signals.emit("SIGINT");
  signals.emit("SIGTERM");
  child.emit("close", -1);
});

test("a relative Windows system root cannot fall back to a process-cleanup PATH search", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter();
  child.pid = 123;
  child.kill = () => true;
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: { SystemRoot: "relative-system-root" },
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    executeFile: () =>
      assert.fail("A relative cleanup executable is forbidden"),
    signals,
  });
  signals.emit("SIGTERM");
  child.emit("close", 0);
  await assert.rejects(pending, /absolute Windows system root/);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("verified cleanup failure remains visible after CLI termination and listener cleanup", async () => {
  const signals = new EventEmitter(),
    child = new EventEmitter(),
    events = [],
    failure = new Error("synthetic owned-tree cleanup denied"),
    killed = Promise.withResolvers();
  child.pid = 123;
  child.kill = (signal) => {
    events.push(signal);
    killed.resolve();
  };
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    executeFile: async (command, args) => {
      assert.ok(command.endsWith("powershell.exe"));
      if (args.at(-1) === "Snapshot") return { stdout: visualTreeSnapshot() };
      assert.equal(args.at(-1), "Stop");
      throw failure;
    },
    signals,
  });
  signals.emit("SIGTERM");
  await killed.promise;
  assert.deepEqual(events, ["SIGTERM"]);
  child.emit("close", 0);
  await assert.rejects(pending, (error) => error === failure);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("captured owned-tree cleanup completes once after child close", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    calls = [],
    snapshot = visualTreeSnapshot(321),
    cleanup = Promise.withResolvers(),
    cleanupStarted = Promise.withResolvers();
  child.pid = 321;
  child.kill = (signal) => calls.push(["cli", signal]);
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: { SystemRoot: String.raw`D:\Windows` },
    cwd: "synthetic-only",
    platform: "win32",
    signals,
    spawnCommand: () => child,
    executeFile: async (command, args, options) => {
      assert.equal(Object.hasOwn(options, "timeout"), false);
      calls.push([command, args]);
      assert.equal(
        command,
        String.raw`D:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,
      );
      if (args.at(-1) === "Snapshot") return { stdout: snapshot };
      assert.equal(args.at(-1), "Stop");
      assert.equal(args.includes("-SnapshotBase64"), false);
      assert.equal(
        Buffer.from(options.input, "base64").toString("utf8"),
        snapshot,
      );
      cleanupStarted.resolve();
      return cleanup.promise;
    },
  });
  signals.emit("SIGINT");
  await cleanupStarted.promise;
  assert.equal(calls.length, 2);
  assert.ok(calls[0][0].endsWith("powershell.exe"));
  assert.ok(calls[1][0].endsWith("powershell.exe"));
  child.emit("close", 0);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  assert.equal(signals.listenerCount("SIGTERM"), 1);
  cleanup.resolve({ stdout: "" });
  assert.equal(await pending, 1);
  signals.emit("SIGTERM");
  assert.equal(calls.length, 2);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("unavailable ownership evidence never authorizes an unverified process-tree termination", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    calls = [],
    snapshotFailure = new Error("synthetic snapshot unavailable");
  child.pid = 123;
  child.kill = () => true;
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    platform: "win32",
    signals,
    spawnCommand: () => child,
    executeFile: (command, args) => {
      calls.push(command);
      assert.ok(command.endsWith("powershell.exe"));
      assert.equal(args.at(-1), "Snapshot");
      throw snapshotFailure;
    },
  });
  signals.emit("SIGINT");
  child.emit("close", 0);
  await assert.rejects(pending, (error) => error === snapshotFailure);
  assert.equal(calls.length, 1);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

for (const cleanupFails of [false, true]) {
  test(`child close during snapshot execution awaits verified orphan cleanup ${cleanupFails ? "failure" : "success"} without targeting a reused PID`, async () => {
    const child = new EventEmitter(),
      signals = new EventEmitter(),
      snapshot = Promise.withResolvers(),
      cleanup = Promise.withResolvers(),
      cleanupStarted = Promise.withResolvers(),
      calls = [],
      failure = new Error("synthetic orphan cleanup failed");
    child.pid = 123;
    child.kill = () => assert.fail("The closed child PID is no longer owned");
    const pending = runVisualChild({
      command: "synthetic-node",
      args: [],
      environment: {},
      cwd: "synthetic-only",
      spawnCommand: () => child,
      platform: "win32",
      signals,
      executeFile: (command, args, options) => {
        assert.ok(command.endsWith("powershell.exe"));
        assert.equal(Object.hasOwn(options, "timeout"), false);
        calls.push(args);
        if (args.at(-1) === "Snapshot") {
          child.emit("close", 0);
          return snapshot.promise;
        }
        assert.equal(args.at(-1), "Stop");
        assert.equal(
          Buffer.from(options.input, "base64").toString("utf8"),
          visualTreeSnapshot(),
        );
        cleanupStarted.resolve();
        return cleanup.promise;
      },
    });
    let settled = false;
    const outcome = pending.then(
      (value) => {
        settled = true;
        return { value };
      },
      (error) => {
        settled = true;
        return { error };
      },
    );

    signals.emit("SIGINT");
    await new Promise(setImmediate);
    assert.equal(settled, false);
    assert.equal(signals.listenerCount("SIGINT"), 1);
    assert.equal(signals.listenerCount("SIGTERM"), 1);
    snapshot.resolve({ stdout: visualTreeSnapshot() });
    await cleanupStarted.promise;
    assert.equal(settled, false);
    assert.equal(calls.length, 2);
    if (cleanupFails) cleanup.reject(failure);
    else cleanup.resolve({ stdout: "" });

    assert.deepEqual(
      await outcome,
      cleanupFails ? { error: failure } : { value: 1 },
    );
    assert.equal(calls.length, 2);
    assert.equal(signals.listenerCount("SIGINT"), 0);
    assert.equal(signals.listenerCount("SIGTERM"), 0);
  });
}

test("child exit before snapshot completion cleans verified orphans and awaits close without targeting a reused PID", async () => {
  for (const exitState of ["exit", "exitCode", "signalCode"]) {
    const child = new EventEmitter(),
      signals = new EventEmitter(),
      snapshot = Promise.withResolvers(),
      cleanup = Promise.withResolvers(),
      cleanupStarted = Promise.withResolvers(),
      calls = [];
    child.pid = 123;
    child.kill = () => assert.fail("The exited child PID is no longer owned");
    const pending = runVisualChild({
      command: "synthetic-node",
      args: [],
      environment: {},
      cwd: "synthetic-only",
      spawnCommand: () => child,
      platform: "win32",
      signals,
      executeFile: (command, args, options) => {
        assert.ok(command.endsWith("powershell.exe"));
        calls.push(args);
        if (args.at(-1) === "Snapshot") return snapshot.promise;
        assert.equal(args.at(-1), "Stop");
        assert.equal(
          Buffer.from(options.input, "base64").toString("utf8"),
          visualTreeSnapshot(),
        );
        cleanupStarted.resolve();
        return cleanup.promise;
      },
    });
    let settled = false;
    pending.then(() => {
      settled = true;
    });

    signals.emit("SIGINT");
    if (exitState === "exit") child.emit("exit", 0, null);
    else if (exitState === "exitCode") child.exitCode = 0;
    else child.signalCode = "SIGTERM";
    snapshot.resolve({ stdout: visualTreeSnapshot() });
    await cleanupStarted.promise;
    assert.equal(settled, false, exitState);
    assert.equal(signals.listenerCount("SIGINT"), 1);
    assert.equal(signals.listenerCount("SIGTERM"), 1);
    cleanup.resolve({ stdout: "" });
    await new Promise(setImmediate);
    assert.equal(settled, false, exitState);
    assert.equal(calls.length, 2);
    assert.equal(signals.listenerCount("SIGINT"), 1);
    assert.equal(signals.listenerCount("SIGTERM"), 1);

    child.emit("close", 0);
    assert.equal(await pending, 1);
    assert.equal(signals.listenerCount("SIGINT"), 0);
    assert.equal(signals.listenerCount("SIGTERM"), 0);
  }
});

test("child close while verified termination is pending waits for tree cleanup completion", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    tree = Promise.withResolvers(),
    treeStarted = Promise.withResolvers(),
    calls = [];
  child.pid = 123;
  child.kill = () => assert.fail("The closed child PID is no longer owned");
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    signals,
    executeFile: async (command, args) => {
      calls.push(command);
      assert.ok(command.endsWith("powershell.exe"));
      if (args.at(-1) === "Snapshot") return { stdout: visualTreeSnapshot() };
      assert.equal(args.at(-1), "Stop");
      treeStarted.resolve();
      return tree.promise;
    },
  });
  let settled = false;
  pending.then(() => {
    settled = true;
  });
  signals.emit("SIGTERM");
  await treeStarted.promise;
  child.emit("close", 0);
  await new Promise(setImmediate);
  assert.equal(settled, false);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  assert.equal(signals.listenerCount("SIGTERM"), 1);
  tree.resolve({ stdout: "" });
  assert.equal(await pending, 1);
  assert.equal(calls.length, 2);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("child and late tree-cleanup failures remain visible after close", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    tree = Promise.withResolvers(),
    treeStarted = Promise.withResolvers(),
    childFailure = new Error("synthetic child failed"),
    treeFailure = new Error("synthetic tree failed");
  child.pid = 123;
  child.kill = () => assert.fail("The closed child PID is no longer owned");
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    signals,
    executeFile: async (command, args) => {
      assert.ok(command.endsWith("powershell.exe"));
      if (args.at(-1) === "Snapshot") return { stdout: visualTreeSnapshot() };
      assert.equal(args.at(-1), "Stop");
      treeStarted.resolve();
      return tree.promise;
    },
  });
  signals.emit("SIGINT");
  await treeStarted.promise;
  child.emit("error", childFailure);
  child.emit("close", 1);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  assert.equal(signals.listenerCount("SIGTERM"), 1);
  tree.reject(treeFailure);
  await assert.rejects(pending, (error) => {
    assert.deepEqual(error.errors, [childFailure, treeFailure]);
    assert.equal(error.cause, treeFailure);
    return true;
  });
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("an aborted helper callback retains cleanup ownership until helper close after visual child close", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    helperStarted = Promise.withResolvers(),
    calls = [],
    abortFailure = Object.assign(new Error("synthetic helper aborted"), {
      name: "AbortError",
    });
  let stoppingHelper,
    settled = false;
  child.pid = 123;
  child.kill = () => assert.fail("The closed child is no longer owned");
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    signals,
    executeFile: (command, args, options) =>
      executeVisualFile(
        command,
        args,
        options,
        (_command, actualArgs, actualOptions, callback) => {
          const helper = new EventEmitter();
          const mode = actualArgs[actualArgs.indexOf("-Mode") + 1];
          calls.push(mode);
          if (mode === "Snapshot") {
            queueMicrotask(() => {
              callback(null, visualTreeSnapshot(), "");
              helper.emit("close", 0, null);
            });
          } else {
            assert.equal(mode, "Stop");
            helper.stdin = new EventEmitter();
            helper.stdin.end = () => {};
            stoppingHelper = helper;
            actualOptions.signal.addEventListener(
              "abort",
              () =>
                callback(abortFailure, "partial cleanup", "aborted diagnostic"),
              { once: true },
            );
            helperStarted.resolve();
          }
          return helper;
        },
      ),
  });
  const outcome = pending.then(
    (value) => {
      settled = true;
      return { value };
    },
    (error) => {
      settled = true;
      return { error };
    },
  );

  signals.emit("SIGINT");
  await helperStarted.promise;
  child.emit("close", 0);
  signals.emit("SIGTERM");
  await new Promise(setImmediate);
  assert.equal(settled, false);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  assert.equal(signals.listenerCount("SIGTERM"), 1);
  assert.deepEqual(calls, ["Snapshot", "Stop"]);

  stoppingHelper.emit("close", 1, "SIGTERM");
  const { error } = await outcome;
  assert.equal(error, abortFailure);
  assert.equal(error.stdout, "partial cleanup");
  assert.equal(error.stderr, "aborted diagnostic");
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

for (const phase of ["Snapshot", "Stop"]) {
  for (const childState of ["running", "closed", "failed"]) {
    test(`repeated cancellation aborts ${phase} cleanup with the child ${childState}`, async () => {
      const child = new EventEmitter(),
        signals = new EventEmitter(),
        helperStarted = Promise.withResolvers(),
        helper = Promise.withResolvers(),
        calls = [],
        kills = [],
        abortFailure = Object.assign(new Error("synthetic helper aborted"), {
          name: "AbortError",
        }),
        childFailure = new Error("synthetic child failed");
      let cleanupSignal,
        aborts = 0;
      child.pid = 123;
      child.kill = (signal) => kills.push(signal);
      const pending = runVisualChild({
        command: "synthetic-node",
        args: [],
        environment: {},
        cwd: "synthetic-only",
        spawnCommand: () => child,
        platform: "win32",
        signals,
        executeFile: (command, args, options) => {
          assert.ok(command.endsWith("powershell.exe"));
          assert.equal(Object.hasOwn(options, "timeout"), false);
          assert.ok(options.signal instanceof AbortSignal);
          assert.equal(options.signal.aborted, false);
          cleanupSignal ??= options.signal;
          assert.equal(options.signal, cleanupSignal);
          const mode = args[args.indexOf("-Mode") + 1];
          calls.push(mode);
          if (phase === "Stop" && mode === "Snapshot")
            return Promise.resolve({ stdout: visualTreeSnapshot() });
          assert.equal(mode, phase);
          options.signal.addEventListener(
            "abort",
            () => {
              aborts++;
              helper.reject(abortFailure);
            },
            { once: true },
          );
          helperStarted.resolve();
          return helper.promise;
        },
      });
      let settled = false;
      const outcome = pending.then(
        (value) => {
          settled = true;
          return { value };
        },
        (error) => {
          settled = true;
          return { error };
        },
      );

      signals.emit("SIGINT");
      await helperStarted.promise;
      assert.equal(cleanupSignal.aborted, false);
      if (childState === "failed") child.emit("error", childFailure);
      if (childState !== "running") child.emit("close", 1);
      assert.equal(settled, false);
      assert.equal(signals.listenerCount("SIGINT"), 1);
      assert.equal(signals.listenerCount("SIGTERM"), 1);

      signals.emit("SIGTERM");
      signals.emit("SIGINT");
      assert.equal(cleanupSignal.aborted, true);
      assert.equal(aborts, 1);
      await new Promise(setImmediate);
      if (childState === "running") {
        assert.equal(settled, false);
        assert.deepEqual(kills, ["SIGTERM"]);
        child.emit("close", 1);
      } else assert.deepEqual(kills, []);

      const { error } = await outcome;
      if (childState === "failed") {
        assert.deepEqual(error.errors, [childFailure, abortFailure]);
        assert.equal(error.cause, abortFailure);
      } else assert.equal(error, abortFailure);
      assert.deepEqual(
        calls,
        phase === "Snapshot" ? ["Snapshot"] : ["Snapshot", "Stop"],
      );
      assert.equal(signals.listenerCount("SIGINT"), 0);
      assert.equal(signals.listenerCount("SIGTERM"), 0);
      signals.emit("SIGINT");
      signals.emit("SIGTERM");
      assert.equal(aborts, 1);
    });
  }
}

test("synchronous close from manual termination waits for shutdown completion", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    kills = [];
  child.pid = 123;
  child.kill = (signal) => {
    kills.push(signal);
    child.emit("close", 0);
  };
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "linux",
    signals,
  });
  signals.emit("SIGINT");
  assert.equal(await pending, 1);
  assert.deepEqual(kills, ["SIGTERM"]);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("Windows visual interruption without an owned PID never starts a tree termination command", async () => {
  for (const pid of [undefined, 0, -1, 1.5]) {
    const signals = new EventEmitter(),
      child = new EventEmitter();
    child.pid = pid;
    child.kill = () => true;
    const pending = runVisualChild({
      command: "synthetic-node",
      args: [],
      environment: {},
      cwd: "synthetic-only",
      spawnCommand: () => child,
      platform: "win32",
      executeFile: () =>
        assert.fail("An owned positive integer PID is required"),
      signals,
    });
    signals.emit("SIGINT");
    child.emit("close", 0);
    assert.equal(await pending, 1);
    assert.equal(signals.listenerCount("SIGINT"), 0);
    assert.equal(signals.listenerCount("SIGTERM"), 0);
  }
});

test("Windows cleanup streams a snapshot larger than the command-line limit without embedding it in arguments", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    stopped = Promise.withResolvers(),
    snapshot = JSON.stringify({
      ...JSON.parse(visualTreeSnapshot()),
      padding: "x".repeat(50_000),
    }),
    calls = [];
  child.pid = 123;
  child.kill = () => child.emit("close", 0);
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    signals,
    executeFile: async (_command, args, options) => {
      const mode = args[args.indexOf("-Mode") + 1];
      calls.push(mode);
      if (mode === "Snapshot") return { stdout: snapshot };
      assert.equal(mode, "Stop");
      assert.deepEqual(args.slice(-2), ["-Mode", "Stop"]);
      assert.equal(args.includes("-SnapshotBase64"), false);
      assert.ok(args.join(" ").length < 32_767);
      assert.ok(options.input.length > 32_767);
      assert.equal(
        Buffer.from(options.input, "base64").toString("utf8"),
        snapshot,
      );
      assert.deepEqual(options.stdio, ["pipe", "pipe", "pipe"]);
      assert.equal(Object.hasOwn(options, "timeout"), false);
      stopped.resolve();
    },
  });
  signals.emit("SIGINT");
  await stopped.promise;
  assert.equal(await pending, 1);
  assert.deepEqual(calls, ["Snapshot", "Stop"]);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("Windows snapshots above Node's default output limit reach verified cleanup intact", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    calls = [],
    makeSnapshot = `JSON.stringify({ schemaVersion: 1, rootProcessId: 123, processes: [
      ...Array.from({ length: 20_000 }, (_, index) => ({ processId: index + 1_000,
        parentProcessId: 123, createdAt: "638900000000000000" })),
      { processId: 123, parentProcessId: 1, createdAt: "638900000000000000" }
    ] })`;
  let captured;
  child.pid = 123;
  child.kill = () => child.emit("close", 0);
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    signals,
    executeFile: async (_command, args, options) => {
      const mode = args.at(-1);
      calls.push(mode);
      if (mode === "Snapshot") {
        assert.ok(Number.isSafeInteger(options.maxBuffer));
        assert.ok(options.maxBuffer <= 32 * 1024 * 1024);
        const result = await executeVisualFile(
          process.execPath,
          ["-e", `process.stdout.write(${makeSnapshot})`],
          options,
        );
        captured = result.stdout;
        assert.ok(Buffer.byteLength(captured) > 1024 * 1024);
        return result;
      }
      assert.equal(mode, "Stop");
      assert.equal(
        Buffer.from(options.input, "base64").toString("utf8"),
        captured,
      );
      const snapshot = JSON.parse(captured);
      assert.equal(snapshot.processes.length, 20_001);
      assert.equal(snapshot.processes.at(-1).processId, 123);
      assert.ok(args.join(" ").length < 32_767);
      return { stdout: "" };
    },
  });

  signals.emit("SIGINT");
  assert.equal(await pending, 1);
  assert.deepEqual(calls, ["Snapshot", "Stop"]);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("shutdown retries failed spawn capture only after its helper closes and stops fresh descendants", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    calls = [],
    firstHelper = new EventEmitter(),
    retryStarted = Promise.withResolvers(),
    retry = Promise.withResolvers(),
    stopped = Promise.withResolvers(),
    snapshotFailure = new Error("synthetic spawn capture unavailable"),
    freshSnapshot = JSON.stringify({
      ...JSON.parse(visualTreeSnapshot()),
      processes: [
        { processId: 456, parentProcessId: 123, createdAt: "2" },
        { processId: 123, parentProcessId: 1, createdAt: "1" },
      ],
    });
  let firstCallback, creationArguments;
  child.pid = 123;
  child.kill = (signal) => {
    calls.push(signal);
    child.emit("close", 0);
  };
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    signals,
    executeFile: (command, args, options) => {
      calls.push(args.at(-1));
      if (calls.length === 1) {
        creationArguments = args;
        return executeVisualFile(command, args, options, (...invocation) => {
          firstCallback = invocation.at(-1);
          return firstHelper;
        });
      }
      assert.deepEqual(args.slice(0, -1), creationArguments.slice(0, -1));
      if (args.at(-1) === "Snapshot") {
        assert.equal(options.signal.aborted, false);
        retryStarted.resolve();
        return retry.promise;
      }
      assert.equal(args.at(-1), "Stop");
      assert.equal(
        Buffer.from(options.input, "base64").toString("utf8"),
        freshSnapshot,
      );
      stopped.resolve();
      return Promise.resolve({ stdout: "" });
    },
  });

  child.emit("spawn");
  firstCallback(snapshotFailure, "", "synthetic CIM failure");
  signals.emit("SIGINT");
  await new Promise(setImmediate);
  assert.deepEqual(calls, ["Snapshot"]);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  firstHelper.emit("close", 1, null);
  await retryStarted.promise;
  assert.deepEqual(calls, ["Snapshot", "Snapshot"]);
  retry.resolve({ stdout: freshSnapshot });
  await stopped.promise;
  assert.equal(await pending, 1);
  assert.deepEqual(calls, ["Snapshot", "Snapshot", "Stop", "SIGTERM"]);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("failed shutdown capture retry preserves both errors without an unverified tree stop", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    calls = [],
    firstFailure = new Error("synthetic early capture failed"),
    retryFailure = new Error("synthetic shutdown capture failed");
  child.pid = 123;
  child.kill = (signal) => {
    calls.push(signal);
    child.emit("close", 0);
  };
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    signals,
    executeFile: async (_command, args) => {
      calls.push(args.at(-1));
      assert.equal(args.at(-1), "Snapshot");
      throw calls.length === 1 ? firstFailure : retryFailure;
    },
  });
  const outcome = assert.rejects(pending, (error) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors, [firstFailure, retryFailure]);
    assert.equal(error.cause, retryFailure);
    return true;
  });

  child.emit("spawn");
  await new Promise(setImmediate);
  signals.emit("SIGINT");
  await outcome;
  assert.deepEqual(calls, ["Snapshot", "Snapshot", "SIGTERM"]);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("failed early capture is never retried against an exited root", async () => {
  for (const exitState of ["exit", "exitCode", "signalCode"]) {
    const child = new EventEmitter(),
      signals = new EventEmitter(),
      calls = [],
      firstFailure = new Error("synthetic early capture failed");
    child.pid = 123;
    child.kill = () => assert.fail("The exited root is no longer owned");
    const pending = runVisualChild({
      command: "synthetic-node",
      args: [],
      environment: {},
      cwd: "synthetic-only",
      spawnCommand: () => child,
      platform: "win32",
      signals,
      executeFile: async (_command, args) => {
        calls.push(args.at(-1));
        assert.equal(calls.length, 1);
        throw firstFailure;
      },
    });
    const outcome = assert.rejects(pending, (error) => error === firstFailure);

    child.emit("spawn");
    await new Promise(setImmediate);
    if (exitState === "exit") child.emit("exit", 0, null);
    else if (exitState === "exitCode") child.exitCode = 0;
    else child.signalCode = "SIGTERM";
    signals.emit("SIGINT");
    child.emit("close", 0);
    await outcome;
    assert.deepEqual(calls, ["Snapshot"], exitState);
    assert.equal(signals.listenerCount("SIGINT"), 0);
    assert.equal(signals.listenerCount("SIGTERM"), 0);
  }
});

test("cancelling early capture waits for helper close and never launches a shutdown retry", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    helper = new EventEmitter(),
    calls = [],
    abortFailure = Object.assign(new Error("synthetic early capture aborted"), {
      name: "AbortError",
    });
  let settled = false;
  child.pid = 123;
  child.kill = (signal) => {
    calls.push(signal);
    child.emit("close", 0);
  };
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    signals,
    executeFile: (command, args, options) => {
      calls.push(args.at(-1));
      assert.equal(calls.length, 1);
      return executeVisualFile(command, args, options, (...invocation) => {
        const callback = invocation.at(-1);
        options.signal.addEventListener(
          "abort",
          () => callback(abortFailure, "", "synthetic cancelled capture"),
          { once: true },
        );
        return helper;
      });
    },
  });
  const outcome = assert.rejects(pending, (error) => {
    settled = true;
    assert.equal(error, abortFailure);
    return true;
  });

  child.emit("spawn");
  signals.emit("SIGINT");
  signals.emit("SIGTERM");
  await new Promise(setImmediate);
  assert.equal(settled, false);
  assert.deepEqual(calls, ["Snapshot"]);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  helper.emit("close", 1, "SIGTERM");
  await outcome;
  assert.deepEqual(calls, ["Snapshot", "SIGTERM"]);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("Windows ownership captured at spawn survives root exit before interruption", async () => {
  const child = new EventEmitter(),
    signals = new EventEmitter(),
    captured = Promise.withResolvers(),
    stopping = Promise.withResolvers(),
    stop = Promise.withResolvers(),
    calls = [],
    snapshot = visualTreeSnapshot();
  let settled = false;
  child.pid = 123;
  child.kill = () => assert.fail("The exited root PID must not be targeted");
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    signals,
    executeFile: async (_command, args, options) => {
      const mode = args[args.indexOf("-Mode") + 1];
      calls.push(mode);
      if (mode === "Snapshot") {
        assert.equal(signals.listenerCount("SIGINT"), 1);
        captured.resolve();
        return { stdout: snapshot };
      }
      assert.equal(mode, "Stop");
      assert.equal(
        Buffer.from(options.input, "base64").toString("utf8"),
        snapshot,
      );
      stopping.resolve();
      return stop.promise;
    },
  });
  const outcome = pending.then((value) => {
    settled = true;
    return value;
  });
  child.emit("spawn");
  await captured.promise;
  await new Promise(setImmediate);
  assert.deepEqual(calls, ["Snapshot"]);
  child.emit("exit", 0, null);
  signals.emit("SIGINT");
  await stopping.promise;
  assert.deepEqual(calls, ["Snapshot", "Stop"]);
  child.emit("close", 0);
  await new Promise(setImmediate);
  assert.equal(settled, false);
  assert.equal(signals.listenerCount("SIGTERM"), 1);
  stop.resolve({ stdout: "" });
  assert.equal(await outcome, 1);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("normal Windows completion cancels early capture and waits for the helper's actual close", async () => {
  const child = new EventEmitter(),
    helper = new EventEmitter(),
    signals = new EventEmitter(),
    captureStarted = Promise.withResolvers(),
    aborted = Promise.withResolvers();
  let settled = false,
    aborts = 0;
  child.pid = 123;
  child.kill = () =>
    assert.fail("A normally completed child must not be terminated");
  const pending = runVisualChild({
    command: "synthetic-node",
    args: [],
    environment: {},
    cwd: "synthetic-only",
    spawnCommand: () => child,
    platform: "win32",
    signals,
    executeFile: (command, args, options) =>
      executeVisualFile(
        command,
        args,
        options,
        (_command, actualArgs, actualOptions, callback) => {
          assert.equal(actualArgs.at(-1), "Snapshot");
          actualOptions.signal.addEventListener(
            "abort",
            () => {
              aborts++;
              callback(
                Object.assign(new Error("synthetic capture cancelled"), {
                  name: "AbortError",
                }),
                "partial capture",
                "cancelled diagnostic",
              );
              aborted.resolve();
            },
            { once: true },
          );
          captureStarted.resolve();
          return helper;
        },
      ),
  });
  const outcome = pending.then((value) => {
    settled = true;
    return value;
  });
  child.emit("spawn");
  await captureStarted.promise;
  child.emit("close", 0);
  await aborted.promise;
  await new Promise(setImmediate);
  assert.equal(settled, false);
  assert.equal(aborts, 1);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  assert.equal(signals.listenerCount("SIGTERM"), 1);
  helper.emit("close", 1, "SIGTERM");
  assert.equal(await outcome, 0);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

for (const failureMode of [
  "write error",
  "synchronous end failure",
  "unavailable input",
]) {
  test(`visual helper stdin ${failureMode} remains observable until actual helper close`, async () => {
    const child = new EventEmitter(),
      input = new EventEmitter(),
      failure = new Error(`synthetic stdin ${failureMode}`),
      payload = "x".repeat(50_000);
    let callback,
      settled = false;
    child.stdin = failureMode === "unavailable input" ? undefined : input;
    child.kill = () => true;
    input.destroy = () => input;
    input.end = (value) => {
      assert.equal(value, payload);
      if (failureMode === "synchronous end failure") throw failure;
      queueMicrotask(() => input.emit("error", failure));
    };
    const pending = executeVisualFile(
      "synthetic-helper",
      ["-Mode", "Stop"],
      { input: payload, stdio: ["pipe", "pipe", "pipe"] },
      (_command, args, options, complete) => {
        assert.deepEqual(args, ["-Mode", "Stop"]);
        assert.equal(Object.hasOwn(options, "input"), false);
        callback = complete;
        return child;
      },
    );
    const outcome = pending.then(
      (value) => {
        settled = true;
        return { value };
      },
      (error) => {
        settled = true;
        return { error };
      },
    );
    callback(null, "synthetic output", "synthetic diagnostic");
    await new Promise(setImmediate);
    assert.equal(settled, false);
    child.emit("close", 0);
    const { error } = await outcome;
    if (failureMode === "unavailable input")
      assert.match(error.message, /Visual helper input is unavailable/);
    else assert.equal(error, failure);
    assert.equal(input.listenerCount("error"), 0);
  });
}

test("the owned helper receives large stdin bytes without adding them to its command line", async () => {
  const input = "synthetic-owned-snapshot-".repeat(3_000);
  const { stdout, stderr } = await executeVisualFile(
    process.execPath,
    [
      "-e",
      'let value = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", chunk => value += chunk); process.stdin.on("end", () => process.stdout.write(value));',
    ],
    { input, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  assert.ok(input.length > 32_767);
  assert.equal(stdout, input);
  assert.equal(stderr, "");
});

test("helper execution and streamed-input failures remain visible together after actual close", async () => {
  const child = new EventEmitter(),
    input = new EventEmitter(),
    helperFailure = Object.assign(new Error("synthetic helper aborted"), {
      name: "AbortError",
    }),
    inputFailure = new Error("synthetic snapshot write failed");
  let callback,
    settled = false;
  child.stdin = input;
  input.end = () => queueMicrotask(() => input.emit("error", inputFailure));
  const pending = executeVisualFile(
    "synthetic-helper",
    ["-Mode", "Stop"],
    { input: "synthetic-only" },
    (_command, _args, _options, complete) => {
      callback = complete;
      return child;
    },
  );
  const outcome = pending.catch((error) => {
    settled = true;
    return error;
  });
  callback(helperFailure, "partial cleanup", "synthetic diagnostic");
  await new Promise(setImmediate);
  assert.equal(settled, false);
  child.emit("close", 1, "SIGTERM");
  const error = await outcome;
  assert.deepEqual(error.errors, [helperFailure, inputFailure]);
  assert.equal(error.cause, helperFailure);
  assert.equal(helperFailure.stdout, "partial cleanup");
  assert.equal(helperFailure.stderr, "synthetic diagnostic");
  assert.equal(input.listenerCount("error"), 0);
});

test(
  "the Windows helper CLI reads stdin and rejects invalid ownership before any native process access",
  { skip: process.platform !== "win32" },
  async () => {
    const powershell = path.win32.join(
      process.env.SystemRoot || String.raw`C:\Windows`,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const helper = path.resolve("scripts/stop-visual-process-tree.ps1");
    const invocation = [
      "$guards = @(Set-PSBreakpoint -Command Get-CimInstance,Get-Process -Action { [Console]::Error.WriteLine('Unexpected native process access'); [Environment]::Exit(81) })",
      `& '${helper.replaceAll("'", "''")}' -Mode Stop -RootProcessId 123 -StartedAfter '2026-10-31T00:00:00Z' -StartedBefore '2026-10-31T00:01:00Z'`,
    ].join("; ");
    const largeInput = Buffer.from(
      JSON.stringify({
        schemaVersion: 0,
        rootProcessId: 123,
        processes: [],
        padding: "x".repeat(50_000),
      }),
    ).toString("base64");
    assert.ok(path.win32.isAbsolute(powershell));
    assert.ok(largeInput.length > 32_767);
    assert.ok(invocation.length < 32_767);
    for (const [input, diagnostic] of [
      ["", /snapshot input is missing/],
      ["not-base64!", /FromBase64String/],
      [largeInput, /snapshot does not identify its owned root/],
    ])
      await assert.rejects(
        executeVisualFile(
          powershell,
          [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            invocation,
          ],
          { input, stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
        ),
        (error) => {
          assert.equal(error.code, 1);
          assert.match(error.stderr, diagnostic);
          assert.equal(error.stdout, "");
          assert.doesNotMatch(error.stderr, /Unexpected native process access/);
          return true;
        },
      );
  },
);
