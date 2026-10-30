import { spawn } from "node:child_process";
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

  const filename = path.resolve(directory);
  const root = await realpath(filename);
  const samePath = (left, right) =>
    process.platform === "win32"
      ? left.toLowerCase() === right.toLowerCase()
      : left === right;
  const status = await lstat(filename);
  if (
    !samePath(root, filename) ||
    status.isSymbolicLink() ||
    !status.isDirectory()
  )
    throw new Error(
      "Reviewed visual baselines must use an ordinary directory.",
    );

  const actualNames = (await readdir(root))
    .filter((name) => /\.png$/i.test(name))
    .sort();
  const reviewedNames = images.map((image) => image.name).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(reviewedNames))
    throw new Error("Reviewed visual baseline image inventory mismatch.");

  for (const image of images) {
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
  }
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

export function runVisualChild({
  command,
  args,
  environment,
  cwd,
  spawnCommand = spawn,
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
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
