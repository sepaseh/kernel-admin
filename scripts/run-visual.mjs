import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
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
  const samePath = (left, right) =>
    process.platform === "win32"
      ? left.toLowerCase() === right.toLowerCase()
      : left === right;
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
      const imageStatus = await lstat(imagePath);
      if (
        imageStatus.isSymbolicLink() ||
        !imageStatus.isFile() ||
        !samePath(await realpath(imagePath), imagePath)
      )
        throw new Error(
          `Reviewed visual baseline must be an ordinary image: ${image.name}`,
        );

      const actualHash = createHash("sha256")
        .update(await readFile(imagePath))
        .digest("hex");
      if (actualHash !== image.sha256)
        throw new Error(
          `Reviewed visual baseline image hash mismatch: ${image.name}`,
        );
    }),
  );
}

export async function fingerprintVisualSources(repository) {
  const root = await realpath(repository);
  const readPublicInput = async (relative) => {
    const filename = path.resolve(root, relative);
    const resolved = await realpath(filename);
    const samePath =
      process.platform === "win32"
        ? resolved.toLowerCase() === filename.toLowerCase()
        : resolved === filename;
    const status = await lstat(filename);
    if (!samePath || status.isSymbolicLink() || !status.isFile())
      throw new Error(
        `Visual source must be an ordinary public file: ${relative}`,
      );
    return readFile(filename);
  };
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

async function ordinaryFile(filename) {
  const status = await lstat(filename);
  if (!status.isFile() || status.isSymbolicLink())
    throw new Error("Verification inputs must be ordinary files.");
  const resolved = await realpath(filename);
  if (
    (process.platform === "win32" ? resolved.toLowerCase() : resolved) !==
    (process.platform === "win32" ? filename.toLowerCase() : filename)
  )
    throw new Error(
      "Verification inputs must remain inside their ordinary directory.",
    );
  return readFile(filename);
}

async function verificationSourceIdentity(repository, environment) {
  const root = await realpath(repository);
  const inventoryName = ".github/bootstrap-policy.json";
  const inventory = JSON.parse(
    await ordinaryFile(path.join(root, inventoryName)),
  );
  // Validate the admitted public paths before following any inventory entry.
  visualSourceInputs(inventory.allowedFiles);
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
  await writeFile(filename, JSON.stringify(identity, null, 2) + "\n");
  return identity;
}

export async function buildVerification({ repository, environment, build }) {
  if (typeof build !== "function")
    throw new Error("An explicit owned verification build driver is required.");
  const before = await verificationSourceIdentity(repository, environment);
  const exitCode = await build();
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

export function runVisualChild({
  command,
  args,
  environment,
  cwd,
  spawnCommand = spawn,
  executeFile = execFileSync,
  platform = process.platform,
  signals = process,
}) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, {
      cwd,
      env: environment,
      stdio: "inherit",
      windowsHide: true,
      timeout: 900_000,
    });
    let failure,
      interrupted = false;
    const interrupt = () => {
      if (interrupted) return;
      interrupted = true;
      if (
        platform === "win32" &&
        Number.isSafeInteger(child.pid) &&
        child.pid > 0
      ) {
        try {
          executeFile(
            String.raw`C:\Windows\System32\taskkill.exe`,
            ["/pid", String(child.pid), "/T", "/F"],
            { stdio: "ignore", windowsHide: true, timeout: 10_000 },
          );
        } catch (error) {
          failure ??= error;
        }
      }
      child.kill("SIGTERM");
    };
    signals.on("SIGINT", interrupt);
    signals.on("SIGTERM", interrupt);
    const removeListeners = () => {
      signals.removeListener("SIGINT", interrupt);
      signals.removeListener("SIGTERM", interrupt);
    };
    child.once("error", (error) => {
      failure = error;
      if (!child.pid) {
        removeListeners();
        reject(error);
      }
    });
    child.once("close", (code) => {
      removeListeners();
      if (failure) reject(failure);
      else resolve(interrupted ? 1 : (code ?? 1));
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
    assertReviewedVisualBaseline(baseline, { ...runtime, platform });
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
    if (args.length === 1 && args[0] === "--build") {
      if (!process.env.npm_execpath)
        throw new Error(
          "Run the verification build through npm run build:verification.",
        );
      await buildVerification({
        repository,
        environment: process.env,
        build: () =>
          runVisualChild({
            command: process.execPath,
            args: [process.env.npm_execpath, "run", "build"],
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
