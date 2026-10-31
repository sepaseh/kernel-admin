import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createLighthouseUrl,
  evaluateLighthouseReport,
} from "./lighthouse-policy.mjs";
import { withVerificationBuild } from "./run-visual.mjs";
import { windowsChromiumFlags } from "./visual-environment.mjs";

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

export function createLighthouseChromeOptions(
  Launcher,
  chromePath,
  platform = process.platform,
) {
  const chromeFlags = ["--headless=new", "--disable-background-networking"];
  if (platform !== "win32") return { chromeFlags, chromePath };

  return {
    chromeFlags: [
      ...windowsChromiumFlags(Launcher.defaultFlags(), platform),
      ...chromeFlags,
    ],
    chromePath,
    ignoreDefaultFlags: true,
  };
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
  reportDirectory = path.resolve("coverage/lighthouse"),
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

export async function prepareLighthouseFixture(
  chromium,
  settings,
  chrome,
  url,
) {
  const browser = await chromium.connectOverCDP(
    `http://127.0.0.1:${chrome.port}`,
  );
  try {
    const context = browser.contexts()[0],
      unexpected = [];
    let settingsRequests = 0;
    await context.route("**/*", (route) => {
      const request = route.request(),
        target = new URL(request.url());
      if (target.origin === new URL(url).origin) return route.continue();
      if (
        target.href === "https://api.example.com/settings" &&
        request.method() === "GET"
      ) {
        settingsRequests++;
        return route.fulfill({ json: settings("en") });
      }
      unexpected.push(`${request.method()} ${target.href}`);
      return route.abort("blockedbyclient");
    });
    context.on("page", (page) =>
      page.on("pageerror", (error) => unexpected.push(error.message)),
    );
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    if (response?.status() !== 200)
      throw new Error("Lighthouse fixture document is not ready.");
    await page
      .locator('input[type="password"]')
      .first()
      .waitFor({ state: "visible" });
    await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible" });
    const verify = () => {
      if (!settingsRequests || unexpected.length)
        throw new Error(
          `Lighthouse fixture failed: ${unexpected.join("; ") || "settings not loaded"}`,
        );
    };
    verify();
    await page.close();
    return { verify, dispose: () => browser.close() };
  } catch (error) {
    try {
      await browser.close();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Lighthouse fixture setup and cleanup failed.",
        { cause: cleanupError },
      );
    }
    throw error;
  }
}

async function main() {
  const repository = fileURLToPath(new URL("../", import.meta.url));
  const metadata = JSON.parse(
    await readFile(path.join(repository, "dist/_kernel/build.json"), "utf8"),
  );
  if (metadata.apiOrigin !== "https://api.example.com")
    throw new Error(
      "Lighthouse requires a completed build using the explicit synthetic API origin.",
    );
  const [{ preview }, launcher, { default: audit }, { chromium }, fixtures] =
    await Promise.all([
      import("vite"),
      import("chrome-launcher"),
      import("lighthouse"),
      import("@playwright/test"),
      import(new URL("../e2e/fixtures.ts", import.meta.url).href),
    ]);
  const operation = () =>
    runLighthouse({
      appBasePath: metadata.basePath,
      preview,
      audit,
      launchChrome: (signal) =>
        launchOwnedChrome(
          launcher.Launcher,
          createLighthouseChromeOptions(
            launcher.Launcher,
            chromium.executablePath(),
          ),
          signal,
        ),
      prepareFixture: (chrome, url) =>
        prepareLighthouseFixture(
          chromium,
          fixtures.applicationSettingsFixture,
          chrome,
          url,
        ),
    });
  const score =
    process.env.KERNEL_REUSE_VERIFICATION_BUILD === "1"
      ? await withVerificationBuild(repository, process.env, operation)
      : await operation();
  console.info(
    `Lighthouse verification passed with a performance score of ${score}.`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
