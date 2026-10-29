import { EventEmitter } from "node:events";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  createLighthouseUrl,
  evaluateLighthouseReport,
  lighthouseThresholds,
  minimumPerformanceScore,
} from "./lighthouse-policy.mjs";
import { launchOwnedChrome, runLighthouse } from "./run-lighthouse.mjs";
import { createBuildMetadata, stampAdminBuild } from "./stamp-admin-build.mjs";

const createReport = ({
  audits = {},
  score = minimumPerformanceScore,
} = {}) => ({
  audits: Object.fromEntries(
    Object.entries(lighthouseThresholds).map(([auditId, maximum]) => [
      auditId,
      { numericValue: audits[auditId] ?? maximum },
    ]),
  ),
  categories: { performance: { score } },
});

const lifecycle = (failures = {}) => {
  const events = [];
  const act = (name) => {
    events.push(name);
    if (Object.hasOwn(failures, name)) throw failures[name];
  };
  const options = {
    appBasePath: "/console/",
    preview: vi.fn(async (config) => {
      act("preview");
      expect(config.preview).toEqual({
        host: "127.0.0.1",
        port: 4174,
        strictPort: true,
      });
      return {
        httpServer: {
          close: (callback) => {
            events.push("preview-close");
            callback(failures["preview-close"]);
          },
        },
      };
    }),
    launchChrome: vi.fn(async () => {
      act("launch");
      return { port: 9222, kill: async () => act("chrome-close") };
    }),
    prepareFixture: vi.fn(async () => {
      act("fixture");
      return {
        verify: async () => act("verify"),
        dispose: async () => act("fixture-close"),
      };
    }),
    audit: vi.fn(async (url, flags) => {
      act("audit");
      expect(url).toBe("http://127.0.0.1:4174/console/auth");
      expect(flags.port).toBe(9222);
      return {
        lhr: createReport(),
        report: ["<html>synthetic report</html>", "{}"],
      };
    }),
    writeReports: vi.fn(async () => act("write")),
  };
  return { events, options };
};

describe("owned Lighthouse lifecycle", () => {
  it("SIGINT cancels an in-flight audit, closes only owned resources and removes listeners", async () => {
    const fixture = lifecycle(),
      signals = new EventEmitter();
    let started;
    const auditing = new Promise((resolve) => {
      started = resolve;
    });
    fixture.options.audit.mockImplementation(async () => {
      fixture.events.push("audit");
      started();
      return new Promise(() => {});
    });
    const pending = runLighthouse({ ...fixture.options, signals });
    await auditing;
    signals.emit("SIGINT");
    await expect(pending).rejects.toMatchObject({ signal: "SIGINT" });
    expect(
      fixture.events.filter((event) => event.endsWith("-close")).sort(),
    ).toEqual(["chrome-close", "fixture-close", "preview-close"]);
    expect(fixture.options.writeReports).not.toHaveBeenCalled();
    expect(
      signals.listenerCount("SIGINT") + signals.listenerCount("SIGTERM"),
    ).toBe(0);
  });

  it("SIGTERM during Chrome startup kills the partial owned instance and the preview", async () => {
    const fixture = lifecycle(),
      signals = new EventEmitter();
    let started;
    const launching = new Promise((resolve) => {
      started = resolve;
    });
    let complete;
    const launchResult = new Promise((resolve) => {
      complete = resolve;
    });
    class PartialLauncher {
      async launch() {
        fixture.events.push("partial-start");
        started();
        await launchResult;
        fixture.events.push("partial-ready");
      }
      async kill() {
        fixture.events.push("partial-close");
      }
    }
    fixture.options.launchChrome = (signal) =>
      launchOwnedChrome(PartialLauncher, {}, signal);
    const pending = runLighthouse({ ...fixture.options, signals });
    let settled = false;
    pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await launching;
    signals.emit("SIGTERM");
    await new Promise(setImmediate);
    expect(settled).toBe(false);
    expect(signals.listenerCount("SIGTERM")).toBe(1);
    signals.emit("SIGTERM");
    expect(fixture.events).toEqual(["preview", "partial-start"]);
    complete();
    await expect(pending).rejects.toMatchObject({ signal: "SIGTERM" });
    expect(fixture.events).toEqual([
      "preview",
      "partial-start",
      "partial-ready",
      "partial-close",
      "preview-close",
    ]);
    expect(
      signals.listenerCount("SIGINT") + signals.listenerCount("SIGTERM"),
    ).toBe(0);
  });

  it("cancellation waits for a pending preview handle and closes it before finishing", async () => {
    const fixture = lifecycle(),
      signals = new EventEmitter();
    let started, complete;
    const starting = new Promise((resolve) => {
      started = resolve;
    });
    const previewResult = new Promise((resolve) => {
      complete = resolve;
    });
    fixture.options.preview.mockImplementation(async () => {
      started();
      return previewResult;
    });
    const pending = runLighthouse({ ...fixture.options, signals });
    let settled = false;
    pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await starting;
    signals.emit("SIGINT");
    await new Promise(setImmediate);
    expect(settled).toBe(false);
    expect(signals.listenerCount("SIGINT")).toBe(1);
    signals.emit("SIGINT");
    complete({
      httpServer: {
        close: (callback) => {
          fixture.events.push("preview-close");
          callback();
        },
      },
    });
    await expect(pending).rejects.toMatchObject({ signal: "SIGINT" });
    expect(fixture.events).toEqual(["preview-close"]);
    expect(fixture.options.launchChrome).not.toHaveBeenCalled();
    expect(
      signals.listenerCount("SIGINT") + signals.listenerCount("SIGTERM"),
    ).toBe(0);
  });

  it("an interrupt during cleanup cannot report a successful audit", async () => {
    const fixture = lifecycle(),
      signals = new EventEmitter();
    fixture.options.prepareFixture.mockResolvedValue({
      verify: async () => undefined,
      dispose: async () => {
        signals.emit("SIGTERM");
      },
    });
    await expect(
      runLighthouse({ ...fixture.options, signals }),
    ).rejects.toMatchObject({ signal: "SIGTERM" });
    expect(
      fixture.events.filter((event) => event === "chrome-close"),
    ).toHaveLength(1);
    expect(fixture.events.at(-1)).toBe("preview-close");
    expect(
      signals.listenerCount("SIGINT") + signals.listenerCount("SIGTERM"),
    ).toBe(0);
  });

  it("cancellation awaits an in-flight report write before releasing resources or finishing", async () => {
    const fixture = lifecycle(),
      signals = new EventEmitter();
    let started, complete;
    const writing = new Promise((resolve) => {
      started = resolve;
    });
    const writeResult = new Promise((resolve) => {
      complete = resolve;
    });
    fixture.options.writeReports.mockImplementation(async () => {
      fixture.events.push("write");
      started();
      await writeResult;
      fixture.events.push("write-complete");
    });
    const pending = runLighthouse({ ...fixture.options, signals });
    let settled = false;
    pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await writing;
    signals.emit("SIGINT");
    await new Promise(setImmediate);
    expect(settled).toBe(false);
    expect(signals.listenerCount("SIGINT")).toBe(1);
    signals.emit("SIGINT");
    complete();
    await expect(pending).rejects.toMatchObject({ signal: "SIGINT" });
    expect(fixture.events.indexOf("write-complete")).toBeLessThan(
      fixture.events.indexOf("fixture-close"),
    );
    expect(
      fixture.events.filter((event) => event === "chrome-close"),
    ).toHaveLength(1);
    expect(fixture.events).not.toContain("verify");
    expect(fixture.events.at(-1)).toBe("preview-close");
    expect(
      signals.listenerCount("SIGINT") + signals.listenerCount("SIGTERM"),
    ).toBe(0);
  });

  it("cancellation preserves every cleanup error and attempts each owned cleanup once", async () => {
    const cleanup = new Error("synthetic cancelled Chrome cleanup"),
      fixture = lifecycle({ "chrome-close": cleanup }),
      signals = new EventEmitter();
    let started;
    const auditing = new Promise((resolve) => {
      started = resolve;
    });
    fixture.options.audit.mockImplementation(async () => {
      started();
      return new Promise(() => {});
    });
    const pending = runLighthouse({ ...fixture.options, signals });
    await auditing;
    signals.emit("SIGINT");
    await expect(pending).rejects.toMatchObject({
      errors: [expect.objectContaining({ signal: "SIGINT" }), cleanup],
    });
    expect(
      fixture.events.filter((event) => event === "chrome-close"),
    ).toHaveLength(1);
    expect(fixture.events.at(-1)).toBe("preview-close");
    expect(
      signals.listenerCount("SIGINT") + signals.listenerCount("SIGTERM"),
    ).toBe(0);
  });

  it("cleans a partly started Chrome when debugger readiness fails and also closes the preview", async () => {
    const failure = new Error("synthetic debugger readiness"),
      fixture = lifecycle();
    class PartialLauncher {
      async launch() {
        fixture.events.push("partial-chrome-start");
        throw failure;
      }
      async kill() {
        fixture.events.push("partial-chrome-close");
      }
    }
    fixture.options.launchChrome = () => launchOwnedChrome(PartialLauncher, {});
    await expect(runLighthouse(fixture.options)).rejects.toBe(failure);
    expect(fixture.events).toEqual([
      "preview",
      "partial-chrome-start",
      "partial-chrome-close",
      "preview-close",
    ]);
  });

  it("retains both partial Chrome launch and owned cleanup failures", async () => {
    const primary = new Error("synthetic partial launch"),
      cleanup = new Error("synthetic Chrome cleanup"),
      fixture = lifecycle();
    class PartialLauncher {
      async launch() {
        throw primary;
      }
      async kill() {
        throw cleanup;
      }
    }
    fixture.options.launchChrome = () => launchOwnedChrome(PartialLauncher, {});
    await expect(runLighthouse(fixture.options)).rejects.toMatchObject({
      errors: [primary, cleanup],
    });
    expect(fixture.events.at(-1)).toBe("preview-close");
  });

  it("writes both reports, verifies the real fixture and cleans every owned resource", async () => {
    const fixture = lifecycle();
    await expect(runLighthouse(fixture.options)).resolves.toBe(60);
    expect(fixture.events).toEqual([
      "preview",
      "launch",
      "fixture",
      "audit",
      "write",
      "verify",
      "fixture-close",
      "chrome-close",
      "preview-close",
    ]);
  });

  it.each(["preview", "launch", "fixture", "audit", "write", "verify"])(
    "preserves a %s failure and releases exactly the acquired resources",
    async (stage) => {
      const failure = new Error(`synthetic ${stage}`),
        fixture = lifecycle({ [stage]: failure });
      await expect(runLighthouse(fixture.options)).rejects.toBe(failure);
      expect(
        fixture.events.filter((event) => event.endsWith("-close")),
      ).toEqual(
        stage === "preview"
          ? []
          : stage === "launch"
            ? ["preview-close"]
            : stage === "fixture"
              ? ["chrome-close", "preview-close"]
              : ["fixture-close", "chrome-close", "preview-close"],
      );
    },
  );

  it("attempts all cleanup and retains the primary and every cleanup error", async () => {
    const failures = Object.fromEntries(
      ["audit", "fixture-close", "chrome-close", "preview-close"].map(
        (stage) => [stage, new Error(stage)],
      ),
    );
    const fixture = lifecycle(failures);
    await expect(runLighthouse(fixture.options)).rejects.toMatchObject({
      errors: Object.values(failures),
    });
    expect(fixture.events.slice(-3)).toEqual([
      "fixture-close",
      "chrome-close",
      "preview-close",
    ]);
  });

  it("does not hide an undefined rejection value", async () => {
    const fixture = lifecycle({ launch: undefined });
    await expect(runLighthouse(fixture.options)).rejects.toBeUndefined();
    expect(fixture.events).toEqual(["preview", "launch", "preview-close"]);
  });

  it("keeps reports from a genuine policy failure and still cleans up", async () => {
    const fixture = lifecycle();
    fixture.options.audit.mockResolvedValue({
      lhr: createReport({ score: 0.5 }),
      report: ["report", "{}"],
    });
    await expect(runLighthouse(fixture.options)).rejects.toThrow(
      "performance score 50.00",
    );
    expect(fixture.events).toContain("write");
    expect(fixture.events.slice(-3)).toEqual([
      "fixture-close",
      "chrome-close",
      "preview-close",
    ]);
  });

  it.each([undefined, { lhr: createReport(), report: "only HTML" }])(
    "rejects a missing or partial report",
    async (result) => {
      const fixture = lifecycle();
      fixture.options.audit.mockResolvedValue(result);
      await expect(runLighthouse(fixture.options)).rejects.toThrow(/produce/);
      expect(fixture.options.writeReports).not.toHaveBeenCalled();
    },
  );

  it("validates the target before acquiring any resource", async () => {
    const fixture = lifecycle();
    await expect(
      runLighthouse({ ...fixture.options, appBasePath: "//outside.test/" }),
    ).rejects.toThrow(/Base path/);
    expect(fixture.events).toEqual([]);
  });
});

const publicBuildEnvironment = {
  VITE_API_BASE_URL: "https://api.example.com",
  VITE_APP_BASE_URL: "/console/",
  VITE_RELEASE_ID: "synthetic-v1",
};
const buildFixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "kernel-build-stamp-test-"));
  const build = path.join(root, "dist");
  await mkdir(build);
  await writeFile(
    path.join(build, "index.html"),
    "<html>synthetic completed build</html>",
  );
  return {
    root,
    build,
    cleanup: async () => {
      expect(path.dirname(path.resolve(root))).toBe(path.resolve(tmpdir()));
      expect(path.basename(root).startsWith("kernel-build-stamp-test-")).toBe(
        true,
      );
      await rm(root, { recursive: true, force: true });
    },
  };
};

describe("validated build metadata", () => {
  it("stamps the completed build with exactly the configured immutable identity", async () => {
    const fixture = await buildFixture();
    try {
      const metadata = await stampAdminBuild({
        environment: publicBuildEnvironment,
        buildDirectory: fixture.build,
      });
      expect(metadata).toEqual({
        schemaVersion: 1,
        releaseId: "synthetic-v1",
        basePath: "/console/",
        apiOrigin: "https://api.example.com",
      });
      expect(
        JSON.parse(
          await readFile(
            path.join(fixture.build, "_kernel/build.json"),
            "utf8",
          ),
        ),
      ).toEqual(metadata);
      await expect(
        stampAdminBuild({
          environment: {
            ...publicBuildEnvironment,
            VITE_RELEASE_ID: "another",
          },
          buildDirectory: fixture.build,
        }),
      ).rejects.toMatchObject({ code: "EEXIST" });
    } finally {
      await fixture.cleanup();
    }
  });

  it.each([
    { VITE_API_BASE_URL: "http://api.example.com" },
    { VITE_API_BASE_URL: "https://api.example.com/path" },
    { VITE_RELEASE_ID: "" },
    { VITE_RELEASE_ID: "../escape" },
    { VITE_APP_BASE_URL: "/console" },
  ])("rejects unsafe public metadata before writing anything", (patch) => {
    expect(() =>
      createBuildMetadata({ ...publicBuildEnvironment, ...patch }),
    ).toThrow();
  });

  it("refuses an incomplete build and a linked metadata output before writing outside", async () => {
    const fixture = await buildFixture();
    try {
      await writeFile(path.join(fixture.build, "index.html"), "not HTML");
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
        }),
      ).rejects.toThrow(/completed HTML/);
      await writeFile(
        path.join(fixture.build, "index.html"),
        "<html>synthetic build</html>",
      );
      const outside = path.join(fixture.root, "outside");
      await mkdir(outside);
      await symlink(
        outside,
        path.join(fixture.build, "_kernel"),
        process.platform === "win32" ? "junction" : "dir",
      );
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
        }),
      ).rejects.toThrow(/inside the build/);
    } finally {
      await fixture.cleanup();
    }
  });
});

describe("Lighthouse advisory", () => {
  it.each([
    [undefined, "http://127.0.0.1:4174/auth"],
    ["/", "http://127.0.0.1:4174/auth"],
    ["/admin/", "http://127.0.0.1:4174/admin/auth"],
  ])("builds the authentication URL for base path %s", (basePath, url) => {
    expect(createLighthouseUrl(basePath)).toBe(url);
  });

  it("accepts a report at the advisory boundaries", () => {
    expect(evaluateLighthouseReport(createReport())).toBe(60);
  });

  it("reports the score and every audit that exceeds its threshold", () => {
    expect(() =>
      evaluateLighthouseReport(
        createReport({
          audits: {
            "first-contentful-paint": 6_001,
            "largest-contentful-paint": 6_501,
          },
          score: 0.599,
        }),
      ),
    ).toThrow(
      /performance score 59\.90 \(minimum 60\.00\).*first-contentful-paint 6001\.00.*largest-contentful-paint 6501\.00/s,
    );
  });

  it("keeps the successful score rounded to a whole percentage", () => {
    expect(evaluateLighthouseReport(createReport({ score: 0.604 }))).toBe(60);
    expect(evaluateLighthouseReport(createReport({ score: 0.606 }))).toBe(61);
  });

  it("rejects a below-threshold score even when its diagnostic rounds to the minimum", () => {
    expect(() =>
      evaluateLighthouseReport(createReport({ score: 0.59999 })),
    ).toThrow("performance score 60.00 (minimum 60.00)");
  });

  it.each([
    ["missing report", undefined],
    ["null report", null],
    ["missing categories", { audits: createReport().audits }],
    ["null categories", { ...createReport(), categories: null }],
    ["missing performance", { ...createReport(), categories: {} }],
    [
      "null performance",
      { ...createReport(), categories: { performance: null } },
    ],
  ])("reports an unavailable performance score for %s", (_, report) => {
    expect(() => evaluateLighthouseReport(report)).toThrow(
      "performance score unavailable (expected a finite number between 0 and 1)",
    );
  });

  it.each([
    ["missing audits", { categories: createReport().categories }],
    ["null audits", { ...createReport(), audits: null }],
  ])("reports every required metric as unavailable for %s", (_, report) => {
    expect(() => evaluateLighthouseReport(report)).toThrow(
      /Lighthouse advisory thresholds exceeded:\n.*cumulative-layout-shift unavailable.*first-contentful-paint unavailable.*interactive unavailable.*largest-contentful-paint unavailable.*total-blocking-time unavailable/s,
    );
  });

  it("reports an unavailable required audit instead of crashing", () => {
    const report = createReport();
    delete report.audits.interactive;

    expect(() => evaluateLighthouseReport(report)).toThrow(
      "interactive unavailable",
    );
  });

  it.each([null, undefined, Number.NaN, Infinity, -Infinity, "0.9", {}, 1.01])(
    "rejects an invalid performance score %s",
    (score) => {
      const report = createReport();
      report.categories.performance.score = score;
      expect(() => evaluateLighthouseReport(report)).toThrow();
    },
  );

  it.each([null, undefined, Number.NaN, Infinity, -Infinity, "1", {}, -1])(
    "rejects an invalid required metric %s",
    (value) => {
      const report = createReport();
      report.audits.interactive.numericValue = value;
      expect(() => evaluateLighthouseReport(report)).toThrow();
    },
  );

  it("accepts a perfect finite score and zero-valued measurements", () => {
    expect(
      evaluateLighthouseReport(
        createReport({
          score: 1,
          audits: {
            "cumulative-layout-shift": 0,
            "first-contentful-paint": 0,
            interactive: 0,
            "largest-contentful-paint": 0,
            "total-blocking-time": 0,
          },
        }),
      ),
    ).toBe(100);
  });

  it.each([
    "\\outside.example/",
    "/\\outside.example/",
    "//outside.example/",
    "/../",
    "/%2foutside/",
  ])(
    "rejects a noncanonical base path without changing its loopback origin: %s",
    (basePath) =>
      expect(() => createLighthouseUrl(basePath)).toThrow(/Base path/),
  );
});
