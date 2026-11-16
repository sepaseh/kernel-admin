import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  acquireVisualLock,
  assertReviewedVisualBaseline,
  assertVisualMode,
  assertVisualPortsAvailable,
  inspectVisualBrowser,
  markVisualBaselinePending,
  visualEnvironment,
  windowsChromiumFlags,
  windowsChromiumLaunchOptions,
} from "./visual-environment.mjs";

test("Windows Chromium backport preserves the actual pinned Playwright feature defaults", async () => {
  const packageUrl = import.meta.resolve("playwright-core/package.json");
  const installed = JSON.parse(await readFile(new URL(packageUrl), "utf8"));
  assert.equal(installed.version, "1.64.1");
  const source = await readFile(
    new URL("./lib/coreBundle.js", packageUrl),
    "utf8",
  );
  const block = /disabledFeatures = \[([\s\S]*?)\]\.filter\(Boolean\)/.exec(
    source,
  );
  assert.ok(block, "The pinned SDK must expose its reviewed feature list.");
  const features = JSON.parse(
    "[" + block[1].replace(/\/\/[^\n]*/g, "").replace(/,\s*$/, "") + "]",
  );
  assert.ok(!features.includes("TcpPortRandomizationWin"));
  const original = "--disable-features=" + features.join(",");
  const options = windowsChromiumLaunchOptions("win32");
  assert.deepEqual(Object.keys(options).sort(), ["args", "ignoreDefaultArgs"]);
  assert.deepEqual(options.ignoreDefaultArgs, [original]);
  assert.deepEqual(options.args, [original + ",TcpPortRandomizationWin"]);
  for (const platform of ["linux", "darwin"])
    assert.deepEqual(windowsChromiumLaunchOptions(platform), {});
});

test("Windows feature extension keeps unrelated flags and rejects ambiguous replacements", () => {
  const flags = Object.freeze([
    "--enable-automation",
    "--disable-features=Alpha,Beta",
    "--headless=new",
  ]);
  const extended = windowsChromiumFlags(flags, "win32");
  assert.deepEqual(extended, [
    flags[0],
    flags[1] + ",TcpPortRandomizationWin",
    flags[2],
  ]);
  assert.deepEqual(windowsChromiumFlags(extended, "win32"), extended);
  assert.equal(flags[1], "--disable-features=Alpha,Beta");
  for (const platform of ["linux", "darwin"])
    assert.deepEqual(windowsChromiumFlags(flags, platform), flags);
  for (const invalid of [[], [flags[1], flags[1]]])
    assert.throws(() => windowsChromiumFlags(invalid, "win32"), /One existing/);
});

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
  assert.doesNotThrow(() =>
    assertReviewedVisualBaseline(
      {
        ...metadata,
        captureResult: {
          captureOnly: true,
          status: "complete-pending-human-review",
        },
      },
      expected,
    ),
  );
  for (const invalid of [
    undefined,
    { ...metadata, platform: "linux" },
    { ...metadata, playwright: "another-version" },
    { ...metadata, browserVersion: "another-browser" },
    { ...metadata, captureOnly: true },
    { ...metadata, status: "complete-pending-human-review" },
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
  await assert.doesNotReject(() => assertVisualPortsAvailable([0]));
});

test("strict CLI comparison pins the rendering environment and validates Node compatibility and source provenance", () => {
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
    nodeRange: ">=24.15.0 <25",
    osRelease: metadata.osRelease,
    playwright: metadata.playwright,
    browserVersion: metadata.browserVersion,
    strictProvenance: true,
  };
  assert.equal(assertReviewedVisualBaseline(metadata, expected), undefined);
  assert.equal(
    assertReviewedVisualBaseline(metadata, { ...expected, node: "24.18.0" }),
    undefined,
  );
  for (const node of ["v24.18.1", "v24.22.2"]) {
    const warning = assertReviewedVisualBaseline(metadata, {
      ...expected,
      node,
    });
    assert.match(warning, /24\.18\.0/);
    assert.ok(warning.includes(node));
    assert.ok(warning.includes(expected.nodeRange));
  }
  for (const key of ["arch", "osRelease"])
    assert.throws(
      () =>
        assertReviewedVisualBaseline(
          { ...metadata, [key]: "different" },
          expected,
        ),
      /current runtime/,
    );
  for (const node of [
    undefined,
    null,
    24,
    "",
    "different",
    "24.18",
    "v24.18.0-rc.1",
  ])
    for (const side of ["baseline", "current"])
      assert.throws(
        () =>
          assertReviewedVisualBaseline(
            side === "baseline" ? { ...metadata, node } : metadata,
            side === "current" ? { ...expected, node } : expected,
          ),
        /Node provenance/,
        `${side} Node ${JSON.stringify(node)}`,
      );
  for (const node of ["v24.14.9", "v24.0.0"])
    for (const side of ["baseline", "current"])
      assert.throws(
        () =>
          assertReviewedVisualBaseline(
            side === "baseline" ? { ...metadata, node } : metadata,
            side === "current" ? { ...expected, node } : expected,
          ),
        /supported range/,
      );
  for (const nodeRange of [undefined, null, 24, "invalid", ">=24.20.0 <25"])
    assert.throws(
      () => assertReviewedVisualBaseline(metadata, { ...expected, nodeRange }),
      /supported range/,
    );
  assert.throws(
    () =>
      assertReviewedVisualBaseline(metadata, {
        ...expected,
        node: "v25.0.0",
        nodeRange: ">=24.15.0 <26",
      }),
    /Node major.*current runtime/,
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
