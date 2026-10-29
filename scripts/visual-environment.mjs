import { mkdir, open, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

export async function markVisualBaselinePending(metadataPath, metadata) {
  await mkdir(path.dirname(metadataPath), { recursive: true });
  await writeFile(
    metadataPath,
    `${JSON.stringify({ ...metadata, review: { status: "pending", reviewer: null, reviewedAt: null } }, null, 2)}\n`,
  );
}

async function releaseOwnedLock(handle, filename, removeFile) {
  const failures = [];
  try {
    await handle.close();
  } catch (error) {
    failures.push(error);
  }
  try {
    await removeFile(filename);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length)
    throw new AggregateError(failures, "Visual lock cleanup failed.");
}

export async function acquireVisualLock(
  resultsDirectory,
  { openFile = open, removeFile = unlink } = {},
) {
  await mkdir(resultsDirectory, { recursive: true });
  const filename = path.join(resultsDirectory, ".visual-run.lock");
  let handle;
  try {
    handle = await openFile(filename, "wx");
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "Another visual run owns the build outputs. Do not overlap visual runs.",
        { cause: error },
      );
    throw error;
  }
  try {
    await handle.writeFile(`${process.pid}\n`);
  } catch (error) {
    try {
      await releaseOwnedLock(handle, filename, removeFile);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, ...cleanupError.errors],
        "Visual lock initialization and cleanup failed.",
        { cause: cleanupError },
      );
    }
    throw error;
  }
  return () => releaseOwnedLock(handle, filename, removeFile);
}

export async function inspectVisualBrowser(launchBrowser, environment) {
  const browser = await launchBrowser(environment);
  let version, failure;
  let failed = false;
  try {
    version = browser.version();
  } catch (error) {
    failed = true;
    failure = error;
  }
  try {
    await browser.close();
  } catch (cleanupError) {
    throw new AggregateError(
      [...(failed ? [failure] : []), cleanupError],
      "Visual browser inspection or cleanup failed.",
      { cause: cleanupError },
    );
  }
  if (failed) throw failure;
  return version;
}

export function assertVisualMode({ update, ci, platform }) {
  if (update && ci)
    throw new Error("Visual baseline updates are forbidden in CI.");
  if (!["win32", "linux"].includes(platform))
    throw new Error(`No visual baseline workflow is defined for ${platform}.`);
}

export function assertReviewedVisualBaseline(metadata, expected) {
  if (
    metadata?.platform !== expected.platform ||
    metadata?.playwright !== expected.playwright ||
    metadata?.review?.status !== "reviewed" ||
    typeof metadata.review.reviewer !== "string" ||
    !metadata.review.reviewer.trim() ||
    !Number.isFinite(Date.parse(metadata.review.reviewedAt))
  )
    throw new Error(
      "Visual baseline platform/version/review metadata mismatch.",
    );
  if (
    expected.browserVersion &&
    metadata.browserVersion !== expected.browserVersion
  )
    throw new Error("Installed Chromium does not match reviewed baselines.");
  for (const key of ["arch", "node", "osRelease"])
    if (expected[key] !== undefined && metadata[key] !== expected[key])
      throw new Error(
        `Reviewed baseline ${key} does not match the current runtime.`,
      );
  if (
    expected.strictProvenance &&
    (!/^[a-f0-9]{64}$/.test(metadata.sourceFingerprint ?? "") ||
      !Number.isFinite(Date.parse(metadata.generatedAt)) ||
      !Array.isArray(metadata.sourceInputs) ||
      !metadata.sourceInputs.length ||
      new Set(metadata.sourceInputs).size !== metadata.sourceInputs.length ||
      !metadata.sourceInputs.every(
        (file) =>
          typeof file === "string" &&
          !/[\\:\0\r\n]/.test(file) &&
          file
            .split("/")
            .every((segment) => segment && segment !== "." && segment !== ".."),
      ))
  )
    throw new Error(
      "Reviewed baseline source provenance is missing or invalid.",
    );
}

export function visualEnvironment(inherited = process.env) {
  return {
    PATH: inherited.PATH ?? "",
    ...(inherited.SystemRoot ? { SystemRoot: inherited.SystemRoot } : {}),
    ...(inherited.TEMP ? { TEMP: inherited.TEMP } : {}),
    ...(inherited.TMP ? { TMP: inherited.TMP } : {}),
    CI: inherited.CI ? "1" : "",
    KERNEL_VISUAL_RUNNER: "1",
    KERNEL_SYNTHETIC_ENV: "1",
    NODE_ENV: "production",
    STORYBOOK_DISABLE_TELEMETRY: "1",
    VITE_API_BASE_URL: "https://api.example.com",
    VITE_APP_BASE_URL: "/",
    VITE_RELEASE_ID: "visual-fixture",
  };
}

export async function assertVisualPortsAvailable(ports = [4173]) {
  await Promise.all(
    [...new Set(ports)].map(async (port) => {
      const server = createServer();
      await new Promise((resolve, reject) => {
        server.once("error", () =>
          reject(new Error(`Visual fixture port ${port} is already in use.`)),
        );
        server.listen(port, "127.0.0.1", resolve);
      });
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }),
  );
}
