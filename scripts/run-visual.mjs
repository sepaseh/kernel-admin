import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { release } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  acquireVisualLock,
  assertReviewedVisualBaseline,
  assertVisualMode,
  assertVisualPortsAvailable,
  inspectVisualBrowser,
  markVisualBaselinePending,
  visualEnvironment,
  visualSourceInputs,
} from "./visual-environment.mjs";

async function canonicalVisualDirectory(directory) {
  const filename = path.resolve(directory);
  const ancestors = [];
  let current = filename;
  while (true) {
    ancestors.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  const statuses = await Promise.all(
    ancestors.map((ancestor) => lstat(ancestor)),
  );
  if (
    statuses.some((status) => status.isSymbolicLink() || !status.isDirectory())
  )
    throw new Error(
      "Reviewed visual baselines must use an ordinary directory.",
    );

  return realpath(filename);
}

export async function assertVisualBaselineImages(directory, metadata) {
  const images = metadata?.images;
  if (
    !Array.isArray(images) ||
    !images.length ||
    !images.every(
      (image) =>
        /^[a-z0-9][a-z0-9-]*\.png$/.test(image?.name ?? "") &&
        /^[a-f0-9]{64}$/.test(image?.sha256 ?? ""),
    ) ||
    new Set(images.map((image) => image.name)).size !== images.length
  )
    throw new Error("Reviewed visual baseline image hashes are required.");

  const root = await canonicalVisualDirectory(directory);
  const actualNames = new Set(
    (await readdir(root)).filter((name) => /\.png$/i.test(name)),
  );
  if (
    actualNames.size !== images.length ||
    images.some((image) => !actualNames.has(image.name))
  )
    throw new Error("Reviewed visual baseline image inventory mismatch.");

  await Promise.all(
    images.map(async (image) => {
      const imagePath = path.join(root, image.name);
      const bytes = await ordinaryFile(
        imagePath,
        `Reviewed visual baseline must be an ordinary image: ${image.name}`,
      );
      const actualHash = createHash("sha256").update(bytes).digest("hex");
      if (actualHash !== image.sha256)
        throw new Error(
          `Reviewed visual baseline image hash mismatch: ${image.name}`,
        );
    }),
  );
}

export async function fingerprintVisualSources(repository) {
  const root = await realpath(repository);
  const readPublicInput = (relative) =>
    ordinaryFile(
      path.resolve(root, relative),
      `Visual source must be an ordinary public file: ${relative}`,
    );
  const inventory = JSON.parse(
    await readPublicInput(".github/bootstrap-policy.json"),
  );
  const sourceInputs = visualSourceInputs(inventory.allowedFiles);
  const fingerprint = createHash("sha256");
  const inputs = await Promise.all(sourceInputs.map(readPublicInput));
  sourceInputs.forEach((relative, index) => {
    fingerprint.update(relative);
    fingerprint.update("\0");
    fingerprint.update(String(inputs[index].length));
    fingerprint.update("\0");
    fingerprint.update(inputs[index]);
  });
  return { sourceFingerprint: fingerprint.digest("hex"), sourceInputs };
}

const verificationEnvironment = (environment) => {
  const expected = {
    KERNEL_SYNTHETIC_ENV: "1",
    VITE_API_BASE_URL: "https://api.example.com",
    VITE_APP_BASE_URL: "/",
    VITE_OBSERVABILITY_URL: "",
    VITE_RELEASE_ID: "application-verification",
  };
  if (
    Object.entries(expected).some(
      ([key, value]) => (environment[key] ?? "") !== value,
    )
  )
    throw new Error(
      "Verification build reuse requires the synthetic CI environment.",
    );
  return expected;
};

async function ordinaryFile(
  filename,
  message = "Verification inputs must be ordinary files inside their ordinary directory.",
) {
  let handle;
  try {
    handle = await open(
      filename,
      constants.O_RDONLY |
        (constants.O_NOFOLLOW ?? 0) |
        (constants.O_NONBLOCK ?? 0),
    );
  } catch (error) {
    if (error.code === "ELOOP" || error.code === "EISDIR")
      throw new Error(message, { cause: error });
    throw error;
  }
  try {
    const opened = await handle.stat({ bigint: true });
    const resolved = await realpath(filename);
    const entry = await lstat(filename, { bigint: true });
    const samePath =
      process.platform === "win32"
        ? resolved.toLowerCase() === filename.toLowerCase()
        : resolved === filename;
    if (
      !samePath ||
      !opened.isFile() ||
      !entry.isFile() ||
      opened.dev !== entry.dev ||
      opened.ino !== entry.ino
    )
      throw new Error(message);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function inspectVerificationPaths(root, admitted) {
  const directories = new Set(
    [...admitted].flatMap((filename) => {
      const parts = filename.split("/");
      return parts
        .slice(0, -1)
        .map((_, index) => parts.slice(0, index + 1).join("/"));
    }),
  );
  const inspectPaths = async (directory = "") => {
    const entries = await readdir(path.join(root, directory), {
      withFileTypes: true,
    });
    await Promise.all(
      entries.map(async (entry) => {
        const relative = directory ? `${directory}/${entry.name}` : entry.name;
        if (relative === ".git") return;
        if (["node_modules", "coverage", "dist"].includes(relative)) {
          if (!entry.isDirectory() || entry.isSymbolicLink())
            throw new Error(
              "Verification outputs must be ordinary directories.",
            );
          return;
        }
        if (entry.isSymbolicLink())
          throw new Error(
            "Verification source paths must not contain symlinks.",
          );
        if (entry.isDirectory() && directories.has(relative))
          await inspectPaths(relative);
        else if (!entry.isFile() || !admitted.has(relative))
          throw new Error(
            "Verification source contains a path outside its published inventory.",
          );
      }),
    );
  };
  await inspectPaths();
}

export async function verificationSourceIdentity(repository, environment) {
  const root = await realpath(repository);
  const inventoryName = ".github/bootstrap-policy.json";
  const inventory = JSON.parse(
    await ordinaryFile(path.join(root, inventoryName)),
  );
  // Validate the admitted public paths before following any inventory entry.
  visualSourceInputs(inventory.allowedFiles);
  await inspectVerificationPaths(
    root,
    new Set([inventoryName, ...inventory.allowedFiles]),
  );
  const excluded = new Set([
    ".env.example",
    "deploy/docker/.env.example",
    "deploy/native/hosts.env.example",
  ]);
  const inputs = [...new Set([inventoryName, ...inventory.allowedFiles])]
    .filter((filename) => !excluded.has(filename))
    .sort((left, right) => {
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    });
  const hash = createHash("sha256");
  const contents = await Promise.all(
    inputs.map((filename) => ordinaryFile(path.join(root, filename))),
  );
  inputs.forEach((filename, index) => {
    const bytes = contents[index];
    hash.update(filename);
    hash.update("\0");
    hash.update(String(bytes.length));
    hash.update("\0");
    hash.update(bytes);
  });
  return {
    environment: verificationEnvironment(environment),
    sourceFingerprint: hash.digest("hex"),
    sourceInputs: inputs,
  };
}

async function verificationIdentity(repository, environment) {
  const root = await realpath(repository);
  const source = await verificationSourceIdentity(root, environment);
  const buildRoot = path.join(root, "dist");
  const visit = async (directory, prefix = "") => {
    const status = await lstat(directory);
    if (!status.isDirectory() || status.isSymbolicLink())
      throw new Error("Verification output must use ordinary directories.");
    const entries = (await readdir(directory, { withFileTypes: true })).sort(
      (left, right) => left.name.localeCompare(right.name, "en"),
    );
    const files = await Promise.all(
      entries.map(async (entry) => {
        const relative = prefix + entry.name;
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) return visit(filename, relative + "/");

        const bytes = await ordinaryFile(filename);
        return [
          {
            path: relative,
            bytes: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex"),
          },
        ];
      }),
    );
    return files.flat();
  };
  const distribution = await visit(buildRoot);
  if (!distribution.some((file) => file.path === "index.html"))
    throw new Error(
      "Verification reuse requires a completed application build.",
    );
  const build = JSON.parse(
    await ordinaryFile(path.join(buildRoot, "_kernel/build.json")),
  );
  const expected = source.environment;
  if (
    build.schemaVersion !== 1 ||
    build.apiOrigin !== expected.VITE_API_BASE_URL ||
    build.basePath !== expected.VITE_APP_BASE_URL ||
    build.releaseId !== expected.VITE_RELEASE_ID
  )
    throw new Error(
      "Verification build metadata does not match the synthetic CI environment.",
    );
  return {
    schemaVersion: 1,
    ...source,
    distribution,
    build,
  };
}

async function publishVerificationBuild(filename, contents) {
  const temporary = path.join(
    path.dirname(filename),
    `.verification-build-${randomUUID()}.tmp`,
  );
  const handle = await open(temporary, "wx", 0o600);
  const failures = [];
  try {
    await handle.writeFile(contents);
  } catch (error) {
    failures.push(error);
  }
  try {
    await handle.close();
  } catch (error) {
    failures.push(error);
  }
  if (!failures.length) {
    try {
      await rename(temporary, filename);
      return;
    } catch (error) {
      failures.push(error);
    }
  }
  try {
    await unlink(temporary);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      "Verification evidence publication or owned cleanup failed.",
      { cause: failures[0] },
    );
  throw failures[0];
}

async function recordVerificationBuild(
  repository,
  environment,
  expectedSource,
) {
  const root = await realpath(repository);
  const identity = await verificationIdentity(root, environment);
  const {
    environment: actualEnvironment,
    sourceFingerprint,
    sourceInputs,
  } = identity;
  if (
    JSON.stringify(expectedSource) !==
    JSON.stringify({
      environment: actualEnvironment,
      sourceFingerprint,
      sourceInputs,
    })
  )
    throw new Error(
      "Verification sources changed while the application built.",
    );
  const directory = path.join(root, "coverage");
  await mkdir(directory, { recursive: true });
  if ((await realpath(directory)) !== directory)
    throw new Error("Verification evidence must use an ordinary directory.");
  const filename = path.join(directory, "verification-build.json");
  try {
    const status = await lstat(filename);
    if (!status.isFile() || status.isSymbolicLink())
      throw new Error("Verification evidence must be an ordinary file.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await publishVerificationBuild(
    filename,
    JSON.stringify(identity, null, 2) + "\n",
  );
  return identity;
}

export async function buildVerification({
  repository,
  environment,
  build,
  typecheckedSource,
}) {
  if (typeof build !== "function")
    throw new Error("An explicit owned verification build driver is required.");
  const before = await verificationSourceIdentity(repository, environment);
  if (
    typecheckedSource !== undefined &&
    (!/^[a-f\d]{64}$/.test(typecheckedSource) ||
      typecheckedSource !== before.sourceFingerprint)
  )
    throw new Error(
      "The successful typecheck belongs to different source. Run verification again.",
    );
  const exitCode = await build({
    typechecked: typecheckedSource !== undefined,
  });
  if (exitCode !== 0)
    throw new Error(
      `The verification application build failed with exit code ${exitCode}.`,
    );
  return recordVerificationBuild(repository, environment, before);
}

export async function verifyVerificationBuild(repository, environment) {
  const root = await realpath(repository);
  const recorded = JSON.parse(
    await ordinaryFile(path.join(root, "coverage/verification-build.json")),
  );
  const actual = await verificationIdentity(root, environment);
  if (JSON.stringify(recorded) !== JSON.stringify(actual))
    throw new Error(
      "The verification build is stale or its output has changed. Rebuild it first.",
    );
  return actual;
}

export async function withVerificationBuild(
  repository,
  environment,
  operation,
) {
  await verifyVerificationBuild(repository, environment);
  let result, failure;
  try {
    result = await operation();
  } catch (error) {
    failure = error;
  }
  try {
    await verifyVerificationBuild(repository, environment);
  } catch (error) {
    if (failure)
      throw new AggregateError(
        [failure, error],
        "Verification operation and build integrity both failed.",
        { cause: error },
      );
    throw error;
  }
  if (failure) throw failure;
  return result;
}

export function executeVisualFile(
  command,
  args,
  options,
  executeFile = execFile,
) {
  return new Promise((resolve, reject) => {
    let result, failure, inputFailure;
    const onInputError = (error) => {
      inputFailure ??= error;
    };
    const hasInput = options && Object.hasOwn(options, "input");
    let executionOptions = options;
    if (hasInput) {
      executionOptions = { ...options };
      delete executionOptions.input;
    }
    const child = executeFile(
      command,
      args,
      executionOptions,
      (error, stdout, stderr) => {
        if (error) {
          failure = error;
          failure.stdout = stdout;
          failure.stderr = stderr;
        } else result = { stdout, stderr };
      },
    );
    // Cancellation can invoke the callback before the helper actually closes.
    child.once("close", () => {
      if (hasInput) child.stdin?.removeListener("error", onInputError);
      if (inputFailure && result) {
        inputFailure.stdout = result.stdout;
        inputFailure.stderr = result.stderr;
      }
      if (failure && inputFailure && failure !== inputFailure)
        reject(
          new AggregateError(
            [failure, inputFailure],
            "Visual helper execution and input both failed.",
            { cause: failure },
          ),
        );
      else if (failure || inputFailure) reject(failure ?? inputFailure);
      else resolve(result);
    });
    if (hasInput) {
      if (!child.stdin)
        inputFailure = new Error("Visual helper input is unavailable.");
      else {
        child.stdin.once("error", onInputError);
        try {
          child.stdin.end(options.input);
        } catch (error) {
          inputFailure ??= error;
          child.stdin.destroy();
        }
      }
    }
  });
}

function windowsVisualTreeCommand(
  processId,
  environment,
  executeFile,
  creationWindow,
  signal,
) {
  const systemRoot = environment.SystemRoot || String.raw`C:\Windows`;
  if (!path.win32.isAbsolute(systemRoot))
    throw new Error(
      "Visual process cleanup requires an absolute Windows system root.",
    );
  const powershell = path.win32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const helper = fileURLToPath(
    new URL("./stop-visual-process-tree.ps1", import.meta.url),
  );
  const arguments_ = [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    helper,
    "-RootProcessId",
    String(processId),
    "-StartedAfter",
    creationWindow.after,
    "-StartedBefore",
    creationWindow.before,
  ];
  const options = {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    encoding: "utf8",
    signal,
  };
  return { powershell, arguments_, options, executeFile };
}

async function captureWindowsVisualTree(command) {
  const { powershell, arguments_, options, executeFile } = command;
  const { stdout: snapshot } = await executeFile(
    powershell,
    [...arguments_, "-Mode", "Snapshot"],
    { ...options, maxBuffer: 16 * 1024 * 1024 },
  );
  if (!snapshot?.trim())
    throw new Error("The owned visual process snapshot is missing.");
  return snapshot;
}

async function stopWindowsVisualTree(command, snapshot) {
  const { powershell, arguments_, options, executeFile } = command;
  await executeFile(powershell, [...arguments_, "-Mode", "Stop"], {
    ...options,
    stdio: ["pipe", "pipe", "pipe"],
    input: Buffer.from(snapshot, "utf8").toString("base64"),
  });
}

export function runVisualChild({
  command,
  args,
  environment,
  cwd,
  spawnCommand = spawn,
  executeFile = executeVisualFile,
  platform = process.platform,
  signals = process,
}) {
  return new Promise((resolve, reject) => {
    const startedAfter = new Date().toISOString();
    const child = spawnCommand(command, args, {
      cwd,
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    });
    const creationWindow = {
      after: startedAfter,
      before: new Date(Date.now() + 1).toISOString(),
    };
    let failure,
      shutdownFailure,
      exitCode,
      interrupted = false,
      finished = false,
      exited = false,
      closed = false,
      shutdownPending = false,
      capturePending = false,
      capture,
      captureFailure,
      snapshot,
      treeCommand;
    const childExited = () =>
      exited || closed || child.exitCode != null || child.signalCode != null;
    const cancellation = new AbortController();
    const settle = () => {
      if (finished || !closed || shutdownPending || capturePending) return;
      finished = true;
      child.removeListener("spawn", captureTree);
      signals.removeListener("SIGINT", interrupt);
      signals.removeListener("SIGTERM", interrupt);
      if (failure && shutdownFailure)
        reject(
          new AggregateError(
            [failure, shutdownFailure],
            "Visual child and owned process cleanup both failed.",
            { cause: shutdownFailure },
          ),
        );
      else if (failure || shutdownFailure) reject(failure ?? shutdownFailure);
      else resolve(interrupted ? 1 : (exitCode ?? 1));
    };
    const captureTree = () => {
      if (
        capture ||
        finished ||
        platform !== "win32" ||
        !Number.isSafeInteger(child.pid) ||
        child.pid <= 0
      )
        return capture;
      capturePending = true;
      const completion = Promise.withResolvers();
      capture = completion.promise;
      (async () => {
        treeCommand = windowsVisualTreeCommand(
          child.pid,
          environment,
          executeFile,
          creationWindow,
          cancellation.signal,
        );
        return captureWindowsVisualTree(treeCommand);
      })()
        .then(
          (value) => {
            snapshot = value;
          },
          (error) => {
            captureFailure = error;
          },
        )
        .finally(() => {
          capturePending = false;
          completion.resolve();
          settle();
        });
      return capture;
    };
    const shutdown = async () => {
      try {
        if (
          platform === "win32" &&
          Number.isSafeInteger(child.pid) &&
          child.pid > 0 &&
          (capture || !childExited())
        ) {
          const capturedBeforeShutdown = Boolean(capture);
          await captureTree();
          if (
            capturedBeforeShutdown &&
            captureFailure &&
            !childExited() &&
            !cancellation.signal.aborted
          ) {
            const initialFailure = captureFailure;
            capture = undefined;
            captureFailure = undefined;
            await captureTree();
            if (captureFailure)
              throw new AggregateError(
                [initialFailure, captureFailure],
                "Initial visual ownership capture and shutdown retry both failed.",
                { cause: captureFailure },
              );
          }
          if (captureFailure) throw captureFailure;
          await stopWindowsVisualTree(treeCommand, snapshot);
        }
      } catch (error) {
        shutdownFailure = error;
      }
      try {
        if (!childExited()) child.kill("SIGTERM");
      } catch (error) {
        failure ??= error;
      } finally {
        shutdownPending = false;
        settle();
      }
    };
    const interrupt = () => {
      if (finished) return;
      if (interrupted) {
        cancellation.abort();
        return;
      }
      interrupted = true;
      shutdownPending = true;
      void shutdown();
    };
    signals.on("SIGINT", interrupt);
    signals.on("SIGTERM", interrupt);
    child.once("spawn", captureTree);
    child.once("error", (error) => {
      failure ??= error;
      if (!child.pid) {
        closed = true;
        settle();
      }
    });
    child.once("exit", () => {
      exited = true;
    });
    child.once("close", (code) => {
      closed = true;
      exitCode = code;
      if (!interrupted && capturePending) cancellation.abort();
      settle();
    });
  });
}

export async function runVisual({
  update = false,
  ci = "",
  platform = process.platform,
  drivers,
}) {
  assertVisualMode({ update, ci, platform });
  if (!drivers)
    throw new Error("Explicit visual fixture drivers are required.");
  const runtime = await drivers.runtime();
  const baseline = update ? undefined : await drivers.baseline();
  if (!update) {
    const nodeWarning = assertReviewedVisualBaseline(baseline, {
      ...runtime,
      platform,
    });
    if (nodeWarning) console.warn(nodeWarning);
    await drivers.baselineImages(baseline);
  }
  const releaseLock = await drivers.lock();
  let result, failure;
  let failed = false;
  try {
    await drivers.ports();
    const browserVersion = await drivers.browserVersion();
    if (!update)
      assertReviewedVisualBaseline(baseline, {
        ...runtime,
        platform,
        browserVersion,
      });
    const metadata = await drivers.metadata(runtime, browserVersion);
    if (
      !/^[a-f0-9]{64}$/.test(metadata.sourceFingerprint ?? "") ||
      !Array.isArray(metadata.sourceInputs) ||
      !metadata.sourceInputs.length
    )
      throw new Error("Visual source provenance is required before capture.");
    const sourceBefore = {
      sourceFingerprint: metadata.sourceFingerprint,
      sourceInputs: [...metadata.sourceInputs],
    };
    if (update) await drivers.markPending(metadata);
    const exitCode = await drivers.capture({ update, metadata });
    const sourceAfter = await drivers.metadata(runtime, browserVersion);
    if (
      sourceBefore.sourceFingerprint !== sourceAfter.sourceFingerprint ||
      JSON.stringify(sourceBefore.sourceInputs) !==
        JSON.stringify(sourceAfter.sourceInputs)
    )
      throw new Error(
        "Visual source changed while the child built or captured.",
      );
    if (!update) await drivers.baselineImages(baseline);
    result = {
      ...metadata,
      baselineIdentity: baseline,
      mode: update ? "update" : "compare",
      exitCode,
    };
    await drivers.writeResult(result);
  } catch (error) {
    failed = true;
    failure = error;
  }
  try {
    await releaseLock();
  } catch (cleanupError) {
    throw new AggregateError(
      [...(failed ? [failure] : []), cleanupError],
      "Visual operation or lock cleanup failed.",
      { cause: cleanupError },
    );
  }
  if (failed) throw failure;
  return result;
}

async function createVisualDrivers(platform, inherited) {
  const repository = fileURLToPath(new URL("../", import.meta.url));
  const require = createRequire(import.meta.url);
  await readFile(path.join(repository, "playwright.visual.config.ts"), "utf8");
  const { chromium } = await import("@playwright/test");
  const version = JSON.parse(
    await readFile(require.resolve("@playwright/test/package.json"), "utf8"),
  ).version;
  const lock = JSON.parse(
    await readFile(path.join(repository, "package-lock.json"), "utf8"),
  );
  if (version !== lock.packages["node_modules/@playwright/test"]?.version)
    throw new Error("Installed Playwright must match the committed lockfile.");
  const { engines } = JSON.parse(
    await readFile(path.join(repository, "package.json"), "utf8"),
  );
  const baselineDirectory = path.join(
    repository,
    "e2e/visual/baselines",
    "application",
    platform,
  );
  const resultsDirectory = path.join(repository, "coverage/visual");
  const runDirectory = path.join(resultsDirectory, `run-${randomUUID()}`);
  const environment = visualEnvironment(inherited);
  if (inherited.KERNEL_REUSE_VERIFICATION_BUILD === "1") {
    environment.KERNEL_REUSE_VERIFICATION_BUILD = "1";
    environment.VITE_RELEASE_ID = "application-verification";
  }
  environment.PLAYWRIGHT_BROWSERS_PATH = path.resolve(
    path.dirname(chromium.executablePath()),
    "../..",
  );
  let captureDirectory;
  return {
    runtime: async () => ({
      playwright: version,
      arch: process.arch,
      node: process.version,
      nodeRange: engines?.node,
      osRelease: release(),
      strictProvenance: true,
    }),
    baseline: async () => {
      try {
        return JSON.parse(
          await readFile(path.join(baselineDirectory, "metadata.json"), "utf8"),
        );
      } catch {
        throw new Error(
          `Missing reviewed ${platform} baselines. Generate separate candidates and obtain human review first.`,
        );
      }
    },
    baselineImages: (metadata) =>
      assertVisualBaselineImages(baselineDirectory, metadata),
    lock: () => acquireVisualLock(resultsDirectory),
    ports: () => assertVisualPortsAvailable(),
    browserVersion: () =>
      inspectVisualBrowser(
        (env) =>
          chromium.launch({
            executablePath: chromium.executablePath(),
            headless: true,
            env,
          }),
        environment,
      ),
    metadata: async (_, browserVersion) => {
      const { sourceFingerprint, sourceInputs } =
        await fingerprintVisualSources(repository);
      return {
        platform,
        arch: process.arch,
        osRelease: release(),
        node: process.version,
        nodeRange: engines?.node,
        playwright: version,
        browser: "bundled-chromium",
        browserVersion,
        sourceFingerprint,
        sourceInputs,
        generatedAt: new Date().toISOString(),
        review: { status: "pending", reviewer: null, reviewedAt: null },
      };
    },
    markPending: async (metadata) => {
      const candidates = path.join(resultsDirectory, "captures");
      await mkdir(candidates, { recursive: true });
      captureDirectory = await mkdtemp(path.join(candidates, "candidate-"));
      await markVisualBaselinePending(
        path.join(captureDirectory, "metadata.json"),
        metadata,
      );
    },
    capture: async ({ update }) => {
      await mkdir(runDirectory, { recursive: true });
      return runVisualChild({
        command: process.execPath,
        args: [
          require.resolve("@playwright/test/cli"),
          "test",
          "--config=playwright.visual.config.ts",
          ...(update ? ["--update-snapshots"] : []),
        ],
        cwd: repository,
        environment: {
          ...environment,
          KERNEL_VISUAL_BASELINES: update
            ? captureDirectory
            : baselineDirectory,
          KERNEL_VISUAL_UPDATE: update ? "1" : "0",
          KERNEL_VISUAL_RESULTS: runDirectory,
        },
      });
    },
    writeResult: async (result) => {
      await mkdir(runDirectory, { recursive: true });
      await writeFile(
        path.join(runDirectory, "environment.json"),
        `${JSON.stringify({ ...result, captureDirectory }, null, 2)}\n`,
        { flag: "wx" },
      );
    },
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2),
    update = args.includes("--update");
  try {
    const repository = fileURLToPath(new URL("../", import.meta.url));
    if (
      args[0] === "--build" &&
      (args.length === 1 ||
        (args.length === 3 && args[1] === "--typechecked-source"))
    ) {
      if (!process.env.npm_execpath)
        throw new Error(
          "Run the verification build through npm run build:verification.",
        );
      await buildVerification({
        repository,
        environment: process.env,
        typecheckedSource: args[2],
        build: ({ typechecked }) =>
          runVisualChild({
            command: process.execPath,
            args: [
              process.env.npm_execpath,
              "run",
              typechecked ? "build:verification:assets" : "build",
            ],
            cwd: repository,
            environment: process.env,
          }),
      });
      console.info("Recorded the current synthetic verification build.");
    } else if (args.length === 1 && args[0] === "--verify-build") {
      await verifyVerificationBuild(repository, process.env);
      console.info("Verified the current synthetic application build.");
    } else {
      if (args.some((arg) => arg !== "--update") || args.length > 1)
        throw new Error(
          "Use the visual runner with at most one --update argument.",
        );
      assertVisualMode({
        update,
        ci: process.env.CI,
        platform: process.platform,
      });
      const drivers = await createVisualDrivers(process.platform, process.env);
      const result = await runVisual({
        update,
        ci: process.env.CI,
        platform: process.platform,
        drivers,
      });
      if (update)
        console.info(
          "New captures remain pending. Obtain human review of every image before promotion; historical baselines were not changed.",
        );
      process.exitCode = result.exitCode;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
