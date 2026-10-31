import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import {
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Launcher } from "chrome-launcher";
import { describe, expect, it, vi } from "vitest";

import {
  createLighthouseUrl,
  evaluateLighthouseReport,
  lighthouseThresholds,
  minimumPerformanceScore,
} from "./lighthouse-policy.mjs";
import {
  createLighthouseChromeOptions,
  launchOwnedChrome,
  prepareLighthouseFixture,
  runLighthouse,
} from "./run-lighthouse.mjs";
import { createBuildMetadata, stampAdminBuild } from "./stamp-admin-build.mjs";

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

const publicBuildEnvironment = {
  VITE_API_BASE_URL: "https://api.example.com",
  VITE_APP_BASE_URL: "/console/",
  VITE_RELEASE_ID: "synthetic-v1",
};
const buildFixture = async (temporaryParent = tmpdir()) => {
  const temporaryRoot = await realpath(temporaryParent);
  const root = await mkdtemp(
    path.join(temporaryRoot, "kernel-build-stamp-test-"),
  );
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
      expect(path.dirname(path.resolve(root))).toBe(temporaryRoot);
      expect(path.basename(root).startsWith("kernel-build-stamp-test-")).toBe(
        true,
      );
      await rm(root, { recursive: true, force: true });
    },
  };
};

describe("validated build metadata", () => {
  it("keeps sibling ownership when the temporary parent is an alias", async () => {
    const temporaryParent = await realpath(tmpdir());
    const root = await mkdtemp(
      path.join(temporaryParent, "kernel-build-parent-test-"),
    );
    const target = path.join(root, "target");
    const alias = path.join(root, "alias");
    let fixture;
    try {
      await mkdir(target);
      await symlink(
        target,
        alias,
        process.platform === "win32" ? "junction" : "dir",
      );
      fixture = await buildFixture(alias);
      const canonicalParent = await realpath(target);
      expect(path.dirname(fixture.root)).toBe(canonicalParent);
      const metadata = await stampAdminBuild({
        environment: publicBuildEnvironment,
        buildDirectory: fixture.build,
        openFile: async (file, flags) => {
          expect(path.dirname(path.dirname(path.dirname(file)))).toBe(
            fixture.root,
          );
          expect(path.relative(fixture.build, file).split(path.sep)[0]).toBe(
            "..",
          );
          expect(flags).toBe("wx");
          return open(file, flags);
        },
      });
      expect(metadata).toEqual(createBuildMetadata(publicBuildEnvironment));
      expect(await readdir(target)).toEqual([path.basename(fixture.root)]);
    } finally {
      if (fixture) await fixture.cleanup();
      expect(path.dirname(root)).toBe(temporaryParent);
      expect(path.basename(root).startsWith("kernel-build-parent-test-")).toBe(
        true,
      );
      await rm(root, { recursive: true, force: true });
    }
  });

  it("publishes only a complete closed identity from its temporary sibling", async () => {
    const fixture = await buildFixture();
    const output = path.join(fixture.build, "_kernel/build.json");
    const events = [];
    let temporary;
    try {
      const metadata = await stampAdminBuild({
        environment: publicBuildEnvironment,
        buildDirectory: fixture.build,
        openFile: async (file, flags) => {
          temporary = file;
          expect(path.relative(fixture.build, file).split(path.sep)[0]).toBe(
            "..",
          );
          expect(path.dirname(path.dirname(path.dirname(file)))).toBe(
            path.dirname(fixture.build),
          );
          expect(file).not.toBe(output);
          expect(flags).toBe("wx");
          const handle = await open(file, flags);
          return {
            writeFile: async (contents) => {
              await handle.writeFile(contents);
              await expect(readFile(output)).rejects.toMatchObject({
                code: "ENOENT",
              });
              events.push("write");
            },
            close: async () => {
              await handle.close();
              events.push("close");
            },
          };
        },
        publishDirectory: async (source, target) => {
          expect(source).toBe(path.dirname(temporary));
          expect(target).toBe(path.dirname(output));
          expect(events).toEqual(["write", "close"]);
          expect(
            JSON.parse(await readFile(path.join(source, "build.json"), "utf8")),
          ).toEqual(createBuildMetadata(publicBuildEnvironment));
          await rename(source, target);
          events.push("publish");
        },
      });
      expect(events).toEqual(["write", "close", "publish"]);
      expect(JSON.parse(await readFile(output, "utf8"))).toEqual(metadata);
      expect(await readdir(path.dirname(output))).toEqual(["build.json"]);
    } finally {
      await fixture.cleanup();
    }
  });

  it.each(["", path.sep])(
    "rejects a linked build directory with trailing separator %j",
    async (separator) => {
      const fixture = await buildFixture();
      const alias = path.join(fixture.root, "build-link");
      try {
        await symlink(
          fixture.build,
          alias,
          process.platform === "win32" ? "junction" : "dir",
        );
        await expect(
          stampAdminBuild({
            environment: publicBuildEnvironment,
            buildDirectory: alias + separator,
          }),
        ).rejects.toThrow(/ordinary directory/);
        await expect(
          readFile(path.join(fixture.build, "_kernel/build.json")),
        ).rejects.toMatchObject({ code: "ENOENT" });
      } finally {
        await fixture.cleanup();
      }
    },
  );

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
      const stampedFile = path.join(fixture.build, "_kernel/build.json");
      const originalBytes = await readFile(stampedFile);
      await expect(
        stampAdminBuild({
          environment: {
            ...publicBuildEnvironment,
            VITE_RELEASE_ID: "another",
          },
          buildDirectory: fixture.build,
        }),
      ).rejects.toMatchObject({ code: "EEXIST" });
      expect(await readFile(stampedFile)).toEqual(originalBytes);
      expect(await readdir(path.dirname(stampedFile))).toEqual(["build.json"]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("keeps an interrupted partial write unpublished and permits a fresh retry", async () => {
    const fixture = await buildFixture();
    const output = path.join(fixture.build, "_kernel/build.json");
    const code = `
      import { open } from "node:fs/promises";
      import { stampAdminBuild } from ${JSON.stringify(new URL("./stamp-admin-build.mjs", import.meta.url).href)};
      const hold = setInterval(() => {}, 1000);
      await stampAdminBuild({
        environment: ${JSON.stringify(publicBuildEnvironment)},
        buildDirectory: ${JSON.stringify(fixture.build)},
        openFile: async (file, flags) => {
          const handle = await open(file, flags);
          return {
            writeFile: async (contents) => {
              const partial = contents.slice(0, 12);
              await handle.writeFile(partial);
              process.send({ temporary: file, partial });
              await new Promise(() => {});
            },
            close: () => handle.close(),
          };
        },
      });
      clearInterval(hold);
    `;
    const child = spawn(
      process.execPath,
      ["--input-type=module", "--eval", code],
      {
        stdio: ["ignore", "ignore", "ignore", "ipc"],
        windowsHide: true,
      },
    );
    const exited = once(child, "exit");
    try {
      const [{ temporary, partial }] = await once(child, "message", {
        signal: AbortSignal.timeout(3000),
      });
      expect(child.kill()).toBe(true);
      await exited;
      await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await readFile(temporary, "utf8")).toBe(partial);
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
        }),
      ).resolves.toEqual(createBuildMetadata(publicBuildEnvironment));
      expect(JSON.parse(await readFile(output, "utf8"))).toEqual(
        createBuildMetadata(publicBuildEnvironment),
      );
      expect(await readFile(temporary, "utf8")).toBe(partial);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill();
        await exited;
      }
      await fixture.cleanup();
    }
  });

  it("preserves an identity that wins the publication race and cleans its temporary file", async () => {
    const fixture = await buildFixture();
    const output = path.join(fixture.build, "_kernel/build.json");
    const winner = Buffer.from("concurrent immutable identity\r\n");
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          publishDirectory: async (source, target) => {
            await mkdir(target);
            await writeFile(path.join(target, "build.json"), winner, {
              flag: "wx",
            });
            await rename(source, target);
          },
        }),
      ).rejects.toHaveProperty("code");
      expect(await readFile(output)).toEqual(winner);
      expect(await readdir(path.dirname(output))).toEqual(["build.json"]);
      expect(await readdir(fixture.root)).toEqual(["dist"]);
    } finally {
      await fixture.cleanup();
    }
  });

  it("keeps the complete published identity when temporary cleanup fails", async () => {
    const fixture = await buildFixture();
    const output = path.join(fixture.build, "_kernel/build.json");
    const cleanupFailure = new Error("synthetic temporary cleanup failure");
    let temporary;
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          removeDirectory: async (directory) => {
            temporary = directory;
            throw cleanupFailure;
          },
        }),
      ).rejects.toBe(cleanupFailure);
      expect(temporary).not.toBe(output);
      expect(JSON.parse(await readFile(output, "utf8"))).toEqual(
        createBuildMetadata(publicBuildEnvironment),
      );
      expect(await readdir(temporary)).toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  it.each(["write", "close"])(
    "removes only its newly acquired metadata after a %s failure",
    async (stage) => {
      const fixture = await buildFixture();
      const failure = new Error(`synthetic ${stage} failure`);
      const events = [];
      const output = path.join(fixture.build, "_kernel/build.json");
      let temporary;
      try {
        await expect(
          stampAdminBuild({
            environment: publicBuildEnvironment,
            buildDirectory: fixture.build,
            openFile: async (file, flags) => {
              events.push("open");
              temporary = file;
              expect(file).not.toBe(output);
              expect(
                path.relative(fixture.build, file).split(path.sep)[0],
              ).toBe("..");
              expect(path.dirname(path.dirname(path.dirname(file)))).toBe(
                path.dirname(fixture.build),
              );
              expect(flags).toBe("wx");
              const handle = await open(file, flags);
              return {
                writeFile: async (contents) => {
                  events.push("write");
                  await handle.writeFile(
                    stage === "write" ? "partial" : contents,
                  );
                  if (stage === "write") throw failure;
                },
                close: async () => {
                  events.push("close");
                  await handle.close();
                  if (stage === "close") throw failure;
                },
              };
            },
            removeFile: async (file) => {
              events.push("unlink");
              expect(file).toBe(temporary);
              await unlink(file);
            },
          }),
        ).rejects.toBe(failure);
        expect(events).toEqual(["open", "write", "close", "unlink"]);
        await expect(readFile(output)).rejects.toMatchObject({
          code: "ENOENT",
        });
        await expect(readFile(temporary)).rejects.toMatchObject({
          code: "ENOENT",
        });
        await expect(
          stampAdminBuild({
            environment: publicBuildEnvironment,
            buildDirectory: fixture.build,
          }),
        ).resolves.toEqual(createBuildMetadata(publicBuildEnvironment));
      } finally {
        await fixture.cleanup();
      }
    },
  );

  it("does not remove an existing file when acquiring the handle fails", async () => {
    const fixture = await buildFixture();
    const failure = new Error("synthetic acquisition failure");
    const output = path.join(fixture.build, "_kernel/build.json");
    const originalBytes = Buffer.from("existing immutable metadata\r\n");
    const removeFile = vi.fn(unlink);
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          openFile: async () => {
            await mkdir(path.dirname(output));
            await writeFile(output, originalBytes);
            throw failure;
          },
          removeFile,
        }),
      ).rejects.toBe(failure);
      expect(removeFile).not.toHaveBeenCalled();
      expect(await readFile(output)).toEqual(originalBytes);
    } finally {
      await fixture.cleanup();
    }
  });

  it("does not remove a temporary path whose exclusive acquisition lost a race", async () => {
    const fixture = await buildFixture();
    const output = path.join(fixture.build, "_kernel/build.json");
    const unowned = Buffer.from("another writer owns this temporary file\r\n");
    const removeFile = vi.fn(unlink);
    let temporary;
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          openFile: async (file, flags) => {
            temporary = file;
            await writeFile(file, unowned, { flag: "wx" });
            return open(file, flags);
          },
          removeFile,
        }),
      ).rejects.toMatchObject({ cause: { code: "EEXIST" } });
      expect(removeFile).not.toHaveBeenCalled();
      expect(await readFile(temporary)).toEqual(unowned);
      await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await fixture.cleanup();
    }
  });

  it("retains partial-write, handle-close and owned-file cleanup errors", async () => {
    const fixture = await buildFixture();
    const primary = new Error("synthetic partial write");
    const closeFailure = new Error("synthetic handle close");
    const cleanupFailure = new Error("synthetic owned-file cleanup");
    const events = [];
    const output = path.join(fixture.build, "_kernel/build.json");
    let temporary;
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          openFile: async (file, flags) => {
            temporary = file;
            const handle = await open(file, flags);
            return {
              writeFile: async () => {
                events.push("write");
                await handle.writeFile("partial");
                throw primary;
              },
              close: async () => {
                events.push("close");
                await handle.close();
                throw closeFailure;
              },
            };
          },
          removeFile: async () => {
            events.push("unlink");
            throw cleanupFailure;
          },
        }),
      ).rejects.toMatchObject({
        errors: expect.arrayContaining([primary, closeFailure, cleanupFailure]),
        cause: primary,
      });
      expect(events).toEqual(["write", "close", "unlink"]);
      expect(await readFile(temporary, "utf8")).toBe("partial");
      await expect(readFile(output)).rejects.toMatchObject({ code: "ENOENT" });
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

  it("does not follow a swapped metadata directory after checking the build", async () => {
    const fixture = await buildFixture();
    const outside = path.join(fixture.root, "outside");
    const directory = path.join(fixture.build, "_kernel");
    const displaced = path.join(fixture.root, "displaced");
    await mkdir(outside);
    try {
      await expect(
        stampAdminBuild({
          environment: publicBuildEnvironment,
          buildDirectory: fixture.build,
          openFile: async (file, flags) => {
            try {
              await rename(directory, displaced);
            } catch (error) {
              if (error.code !== "ENOENT") throw error;
            }
            await symlink(
              outside,
              directory,
              process.platform === "win32" ? "junction" : "dir",
            );
            return open(file, flags);
          },
        }),
      ).rejects.toHaveProperty("code");
      expect(await readdir(outside)).toEqual([]);
      await expect(
        readFile(path.join(outside, "build.json")),
      ).rejects.toMatchObject({ code: "ENOENT" });
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
