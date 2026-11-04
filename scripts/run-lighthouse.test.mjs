import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Launcher } from "chrome-launcher";
import { describe, expect, it, vi } from "vitest";

import { createReport } from "./lighthouse-policy.test-support.mjs";
import {
  createLighthouseChromeOptions,
  launchOwnedChrome,
  prepareLighthouseFixture,
  runLighthouse,
} from "./run-lighthouse.mjs";

const lighthouseFixtureDriver = ({
  requestSettings = true,
  visible = true,
} = {}) => {
  let routeHandler;
  const route = (url) => ({
    request: () => ({ url: () => url, method: () => "GET" }),
    continue: vi.fn(),
    fulfill: vi.fn(),
    abort: vi.fn(),
  });
  const ready = vi.fn(async () => {
    if (!visible)
      throw new Error("synthetic authentication form is not visible");
  });
  const page = {
    goto: vi.fn(async (_, options) => {
      if (options?.waitUntil !== "domcontentloaded")
        throw new Error(
          "synthetic document load waits on an unrelated subresource",
        );
      if (requestSettings)
        await routeHandler(route("https://api.example.com/settings"));
      return { status: () => 200 };
    }),
    locator: vi.fn(() => ({ first: () => ({ waitFor: ready }) })),
    getByRole: vi.fn(() => ({ waitFor: ready })),
    close: vi.fn(async () => undefined),
  };
  const context = {
    route: vi.fn(async (_, handler) => {
      routeHandler = handler;
    }),
    on: vi.fn(),
    newPage: vi.fn(async () => page),
  };
  const auditTarget = {
    context: () => context,
    request: async (url) => {
      expect(page.close).toHaveBeenCalledOnce();
      expect(auditTarget.context().route).toHaveBeenCalledOnce();
      const request = route(url);
      await routeHandler(request);
      return request;
    },
  };
  context.newPage.mockResolvedValueOnce(page).mockResolvedValue(auditTarget);
  const browser = {
    contexts: () => [context],
    close: vi.fn(async () => undefined),
  };
  return {
    browser,
    page,
    ready,
    chromium: { connectOverCDP: vi.fn(async () => browser) },
    settings: vi.fn((language) => ({ language })),
  };
};

describe("Lighthouse authentication fixture readiness", () => {
  it("uses document readiness and the actual settings/form guards without waiting for every subresource", async () => {
    const fixture = lighthouseFixtureDriver();
    const prepared = await prepareLighthouseFixture(
      fixture.chromium,
      fixture.settings,
      { port: 9222 },
      "http://127.0.0.1:4174/auth",
    );
    expect(fixture.settings).toHaveBeenCalledExactlyOnceWith("en");
    expect(fixture.ready).toHaveBeenCalledTimes(2);
    expect(fixture.page.close).toHaveBeenCalledOnce();
    expect(() => prepared.verify()).not.toThrow();
    const auditTarget = await fixture.browser.contexts()[0].newPage();
    expect(auditTarget).not.toBe(fixture.page);
    const application = await auditTarget.request(
      "http://127.0.0.1:4174/auth/app.js",
    );
    expect(application.continue).toHaveBeenCalledOnce();
    expect(application.fulfill).not.toHaveBeenCalled();
    expect(application.abort).not.toHaveBeenCalled();
    expect(() => prepared.verify()).not.toThrow();
    const settings = await auditTarget.request(
      "https://api.example.com/settings",
    );
    expect(settings.fulfill).toHaveBeenCalledExactlyOnceWith({
      json: { language: "en" },
    });
    expect(fixture.settings).toHaveBeenCalledTimes(2);
    expect(() => prepared.verify()).not.toThrow();
    const foreign = await auditTarget.request(
      "https://foreign.example.test/private",
    );
    expect(foreign.abort).toHaveBeenCalledExactlyOnceWith("blockedbyclient");
    expect(() => prepared.verify()).toThrow(/foreign\.example\.test/);
    await prepared.dispose();
    expect(fixture.browser.close).toHaveBeenCalledOnce();
  });

  it.each([
    [{ requestSettings: false }, /settings not loaded/],
    [{ visible: false }, /form is not visible/],
  ])(
    "rejects missing application readiness and closes its owned connection",
    async (options, error) => {
      const fixture = lighthouseFixtureDriver(options);
      await expect(
        prepareLighthouseFixture(
          fixture.chromium,
          fixture.settings,
          { port: 9222 },
          "http://127.0.0.1:4174/auth",
        ),
      ).rejects.toThrow(error);
      expect(fixture.browser.close).toHaveBeenCalledOnce();
    },
  );
});

describe("Windows Lighthouse socket workaround", () => {
  it("extends the public launcher defaults without changing other launch flags", () => {
    const defaults = Launcher.defaultFlags();
    const featureFlag = defaults.find((flag) =>
      flag.startsWith("--disable-features="),
    );
    const options = createLighthouseChromeOptions(
      Launcher,
      "synthetic-chromium",
      "win32",
    );
    expect(options).toEqual({
      chromeFlags: [
        ...defaults.map((flag) =>
          flag === featureFlag ? flag + ",TcpPortRandomizationWin" : flag,
        ),
        "--headless=new",
        "--disable-background-networking",
      ],
      chromePath: "synthetic-chromium",
      ignoreDefaultFlags: true,
    });
    expect(
      options.chromeFlags.filter((flag) =>
        flag.startsWith("--disable-features="),
      ),
    ).toHaveLength(1);
    expect(Launcher.defaultFlags()).toEqual(defaults);
  });

  it.each(["linux", "darwin"])(
    "keeps the original %s launch options",
    (platform) => {
      expect(
        createLighthouseChromeOptions(Launcher, "synthetic-chromium", platform),
      ).toEqual({
        chromeFlags: ["--headless=new", "--disable-background-networking"],
        chromePath: "synthetic-chromium",
      });
    },
  );
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

  it("writes both actual report files through the default writer", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "kernel-lighthouse-reports-test-"),
    );
    const fixture = lifecycle();
    const options = {
      ...fixture.options,
      reportDirectory: path.join(directory, "reports"),
    };
    delete options.writeReports;
    try {
      await expect(runLighthouse(options)).resolves.toBe(60);
      expect(
        await readFile(
          path.join(options.reportDirectory, "report.html"),
          "utf8",
        ),
      ).toBe("<html>synthetic report</html>");
      expect(
        await readFile(
          path.join(options.reportDirectory, "report.json"),
          "utf8",
        ),
      ).toBe("{}");
      expect(fixture.events.slice(-3)).toEqual([
        "fixture-close",
        "chrome-close",
        "preview-close",
      ]);
    } finally {
      expect(path.dirname(path.resolve(directory))).toBe(
        path.resolve(tmpdir()),
      );
      expect(
        path.basename(directory).startsWith("kernel-lighthouse-reports-test-"),
      ).toBe(true);
      await rm(directory, { recursive: true, force: true });
    }
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
