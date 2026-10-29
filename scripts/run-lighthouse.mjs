import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createLighthouseUrl,
  evaluateLighthouseReport,
} from "./lighthouse-policy.mjs";

export {
  createLighthouseUrl,
  evaluateLighthouseReport,
  lighthouseThresholds,
  minimumPerformanceScore,
} from "./lighthouse-policy.mjs";

async function writeLighthouseReports(directory, reports) {
  await mkdir(directory, { recursive: true });
  const results = await Promise.allSettled([
    writeFile(path.join(directory, "report.html"), reports[0]),
    writeFile(path.join(directory, "report.json"), reports[1]),
  ]);
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
  if (failures.length)
    throw new AggregateError(failures, "Lighthouse report writes failed.");
}

async function untilAborted(operation, signal) {
  signal?.throwIfAborted();
  if (!signal) return operation();
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return operation();
      }),
      aborted,
    ]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export async function launchOwnedChrome(Launcher, options, signal) {
  signal?.throwIfAborted();
  if (options.port !== undefined && options.port !== 0)
    throw new Error("Owned Chrome requires a fresh ephemeral debugging port.");
  const instance = new Launcher(options);
  let closing;
  const kill = () =>
    (closing ??= Promise.resolve().then(() => instance.kill()));
  try {
    await instance.launch();
    signal?.throwIfAborted();
  } catch (error) {
    const failure =
      signal?.aborted && error !== signal.reason
        ? new AggregateError(
            [signal.reason, error],
            "Chrome startup was interrupted.",
            { cause: error },
          )
        : error;
    try {
      await kill();
    } catch (cleanupError) {
      throw new AggregateError(
        [failure, cleanupError],
        "Chrome launch and owned-process cleanup failed.",
        { cause: cleanupError },
      );
    }
    throw failure;
  }
  return { port: instance.port, kill };
}

function getLighthouseReports(result) {
  if (!result) throw new Error("Lighthouse did not produce a result.");

  const reports = Array.isArray(result.report)
    ? result.report
    : [result.report];
  if (
    reports.length !== 2 ||
    reports.some((report) => typeof report !== "string")
  )
    throw new Error("Lighthouse must produce both HTML and JSON reports.");

  return reports;
}

export async function runLighthouse({
  appBasePath = "/",
  reportDirectory = path.resolve(".lighthouseci"),
  preview,
  launchChrome,
  audit,
  prepareFixture = async () => undefined,
  writeReports = writeLighthouseReports,
  signals = process,
}) {
  const url = createLighthouseUrl(appBasePath);
  if (
    ![preview, launchChrome, audit].every(
      (driver) => typeof driver === "function",
    )
  )
    throw new Error(
      "Explicit Lighthouse preview, browser and audit drivers are required.",
    );
  let server, chrome, fixture, score, failure;
  let failed = false;
  const cleanupFailures = [];
  const controller = new AbortController();
  let chromeClosing;
  const closeChrome = () =>
    (chromeClosing ??= Promise.resolve().then(() => chrome.kill()));
  const interrupt = (signal) => {
    if (controller.signal.aborted) return;
    const error = new Error(`Lighthouse interrupted by ${signal}.`);
    error.signal = signal;
    controller.abort(error);
    if (chrome)
      void closeChrome().catch(() => {
        // Cleanup awaits this same cached promise and retains its failure.
      });
  };
  const onInterrupt = () => interrupt("SIGINT");
  const onTerminate = () => interrupt("SIGTERM");
  signals.on("SIGINT", onInterrupt);
  signals.on("SIGTERM", onTerminate);
  try {
    server = await preview({
      preview: { host: "127.0.0.1", port: 4174, strictPort: true },
    });
    controller.signal.throwIfAborted();
    chrome = await launchChrome(controller.signal);
    controller.signal.throwIfAborted();
    fixture = await prepareFixture(chrome, url, controller.signal);
    controller.signal.throwIfAborted();
    const result = await untilAborted(
      () =>
        audit(url, {
          logLevel: "error",
          onlyCategories: ["performance"],
          output: ["html", "json"],
          port: chrome.port,
        }),
      controller.signal,
    );
    const reports = getLighthouseReports(result);
    await writeReports(reportDirectory, reports);
    controller.signal.throwIfAborted();
    await fixture?.verify();
    controller.signal.throwIfAborted();
    score = evaluateLighthouseReport(result.lhr);
  } catch (error) {
    failed = true;
    failure =
      controller.signal.aborted && error !== controller.signal.reason
        ? new AggregateError(
            [controller.signal.reason, error],
            "Lighthouse operation was interrupted.",
            { cause: error },
          )
        : error;
  }
  const attempt = async (action) => {
    try {
      await action();
    } catch (error) {
      cleanupFailures.push(error);
    }
  };
  if (fixture) await attempt(() => fixture.dispose());
  if (chrome) await attempt(closeChrome);
  if (server)
    await attempt(
      () =>
        new Promise((resolve, reject) =>
          server.httpServer.close((error) =>
            error ? reject(error) : resolve(),
          ),
        ),
    );
  if (!failed && controller.signal.aborted) {
    failed = true;
    failure = controller.signal.reason;
  }
  signals.removeListener("SIGINT", onInterrupt);
  signals.removeListener("SIGTERM", onTerminate);
  if (cleanupFailures.length)
    throw new AggregateError(
      [...(failed ? [failure] : []), ...cleanupFailures],
      "Lighthouse operation or owned-resource cleanup failed.",
    );
  if (failed) throw failure;
  return score;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.error(
    "Application Lighthouse CLI integration is not published in this phase.",
  );
  process.exitCode = 1;
}
