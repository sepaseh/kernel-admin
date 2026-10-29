import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertReviewedVisualBaseline,
  assertVisualMode,
} from "./visual-environment.mjs";

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
  if (!update) assertReviewedVisualBaseline(baseline, { ...runtime, platform });
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
    if (update) await drivers.markPending(metadata);
    const exitCode = await drivers.capture({ update, metadata });
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

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    assertVisualMode({
      update: process.argv.slice(2).includes("--update"),
      ci: process.env.CI,
      platform: process.platform,
    });
    throw new Error(
      "Application visual CLI integration is not published in this phase.",
    );
  } catch (error) {
    console.error(error.message);
  }
  process.exitCode = 1;
}
