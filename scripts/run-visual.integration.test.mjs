import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  link,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertVisualBaselineImages,
  buildVerification,
  fingerprintVisualSources,
  verificationSourceIdentity,
  verifyVerificationBuild,
  withVerificationBuild,
} from "./run-visual.mjs";
import {
  acquireVisualLock,
  visualEnvironment,
  visualSourceInputs,
} from "./visual-environment.mjs";

function runOwnedCommand(
  command,
  args,
  { encoding = "utf8", ...options },
  onStderr,
) {
  return new Promise((resolve) => {
    const child = spawn(command, args, options);
    let stdout = "",
      stderr = "",
      failure,
      interrupted = false;
    const interrupt = () => {
      if (interrupted) return;
      interrupted = true;
      try {
        if (child.exitCode == null && child.signalCode == null)
          child.kill("SIGTERM");
      } catch (error) {
        failure ??= error;
      }
    };
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", interrupt);
    child.stdout.setEncoding(encoding);
    child.stderr.setEncoding(encoding);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      onStderr?.(chunk);
    });
    child.once("error", (error) => {
      failure ??= error;
    });
    child.once("close", (code, signal) => {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
      resolve({
        status: interrupted ? 1 : code,
        signal,
        stdout,
        stderr,
        error: failure,
      });
    });
  });
}

const withBuildFixture = async (run) => {
  const directory = await mkdtemp(path.join(tmpdir(), "kernel-build-proof-"));
  const environment = {
    KERNEL_SYNTHETIC_ENV: "1",
    VITE_API_BASE_URL: "https://api.example.com",
    VITE_APP_BASE_URL: "/",
    VITE_OBSERVABILITY_URL: "",
    VITE_RELEASE_ID: "application-verification",
  };
  const files = [
    ".nvmrc",
    "package.json",
    "package-lock.json",
    "index.html",
    "vite.config.ts",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "playwright.visual.config.ts",
    "scripts/run-visual.mjs",
    "scripts/visual-environment.mjs",
    "scripts/stamp-admin-build.mjs",
    "scripts/validate-production-env.mjs",
    "scripts/validate-deployment-env.mjs",
    "src/app/App.tsx",
    "docs/public.md",
  ];
  try {
    await mkdir(path.join(directory, ".github"));
    await writeFile(
      path.join(directory, ".github/bootstrap-policy.json"),
      JSON.stringify({
        allowedFiles: [
          ...files,
          ".env.example",
          "deploy/docker/.env.example",
          "deploy/native/hosts.env.example",
        ],
      }),
    );
    for (const filename of files) {
      await mkdir(path.dirname(path.join(directory, filename)), {
        recursive: true,
      });
      await writeFile(
        path.join(directory, filename),
        `synthetic public ${filename}`,
      );
    }
    await mkdir(path.join(directory, "dist/_kernel"), { recursive: true });
    await writeFile(
      path.join(directory, "dist/index.html"),
      "<html>synthetic</html>",
    );
    await writeFile(
      path.join(directory, "dist/app.js"),
      "synthetic built application",
    );
    await writeFile(
      path.join(directory, "dist/_kernel/build.json"),
      JSON.stringify({
        schemaVersion: 1,
        releaseId: environment.VITE_RELEASE_ID,
        basePath: environment.VITE_APP_BASE_URL,
        apiOrigin: environment.VITE_API_BASE_URL,
      }),
    );
    await run(directory, environment);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("kernel-build-proof-"));
    await rm(directory, { recursive: true, force: true });
  }
};

test("verification reuse binds the public source, build bytes and synthetic environment", async () => {
  await withBuildFixture(async (directory, environment) => {
    let builds = 0;
    const identity = await buildVerification({
      repository: directory,
      environment,
      build: async () => {
        builds++;
        return 0;
      },
    });
    assert.equal(builds, 1);
    assert.deepEqual(
      await verifyVerificationBuild(directory, environment),
      identity,
    );
    assert.ok(
      !identity.sourceInputs.some((file) => file.includes(".env.example")),
    );
    await assert.rejects(
      verifyVerificationBuild(directory, {
        ...environment,
        VITE_RELEASE_ID: "different",
      }),
      /synthetic CI environment/,
    );
    await writeFile(
      path.join(directory, "docs/public.md"),
      "changed public tree",
    );
    await assert.rejects(
      verifyVerificationBuild(directory, environment),
      /stale/,
    );
  });
});

test("only a matching coordinator typecheck selects the reduced verification build", async () => {
  await withBuildFixture(async (directory, environment) => {
    const { sourceFingerprint } = await verificationSourceIdentity(
      directory,
      environment,
    );
    const invocations = [];
    const build = async (options) => {
      invocations.push(options);
      return 0;
    };
    await buildVerification({ repository: directory, environment, build });
    await buildVerification({
      repository: directory,
      environment,
      build,
      typecheckedSource: sourceFingerprint,
    });
    assert.deepEqual(invocations, [
      { typechecked: false },
      { typechecked: true },
    ]);

    await writeFile(path.join(directory, "src/app/App.tsx"), "source changed");
    await assert.rejects(
      buildVerification({
        repository: directory,
        environment,
        build,
        typecheckedSource: sourceFingerprint,
      }),
      /typecheck belongs to different source/,
    );
    assert.equal(invocations.length, 2);
  });
});

test("a newly introduced source file cannot reuse an earlier typecheck", async () => {
  await withBuildFixture(async (directory, environment) => {
    const { sourceFingerprint } = await verificationSourceIdentity(
      directory,
      environment,
    );
    await writeFile(
      path.join(directory, "src/app/unchecked.ts"),
      "export const unchecked: number = 'invalid';",
    );
    let builds = 0;
    await assert.rejects(
      buildVerification({
        repository: directory,
        environment,
        typecheckedSource: sourceFingerprint,
        build: async () => {
          builds++;
          return 0;
        },
      }),
      /outside its published inventory/,
    );
    assert.equal(builds, 0);
  });
});

test("verification keeps ordinal source fingerprints and ordered nested output inventories", async () => {
  await withBuildFixture(async (directory, environment) => {
    const inventoryPath = path.join(directory, ".github/bootstrap-policy.json");
    const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
    const extraSources = ["src/alpha.ts", "src/Zebra.ts"];
    inventory.allowedFiles.push(...extraSources);
    await writeFile(inventoryPath, JSON.stringify(inventory));
    for (const filename of extraSources)
      await writeFile(path.join(directory, filename), `synthetic ${filename}`);
    await mkdir(path.join(directory, "dist/assets/chunks"), {
      recursive: true,
    });
    for (const filename of [
      "assets/chunks/last.js",
      "assets/chunks/first.js",
      "assets/a.css",
    ])
      await writeFile(
        path.join(directory, "dist", filename),
        `synthetic output ${filename}`,
      );

    const identity = await buildVerification({
      repository: directory,
      environment,
      build: async () => 0,
    });
    assert.ok(
      identity.sourceInputs.indexOf("src/Zebra.ts") <
        identity.sourceInputs.indexOf("src/alpha.ts"),
    );
    assert.deepEqual(
      identity.distribution.map((file) => file.path),
      [
        "_kernel/build.json",
        "app.js",
        "assets/a.css",
        "assets/chunks/first.js",
        "assets/chunks/last.js",
        "index.html",
      ],
    );
    assert.deepEqual(
      await verifyVerificationBuild(directory, environment),
      identity,
    );
  });
});

test("a missing admitted source rejects the build before execution or evidence publication", async () => {
  await withBuildFixture(async (directory, environment) => {
    let builds = 0;
    await rm(path.join(directory, "docs/public.md"));

    await assert.rejects(
      buildVerification({
        repository: directory,
        environment,
        build: async () => {
          builds++;
          return 0;
        },
      }),
      { code: "ENOENT" },
    );
    assert.equal(builds, 0);
    await assert.rejects(
      readFile(path.join(directory, "coverage/verification-build.json")),
      { code: "ENOENT" },
    );
  });
});

test("a failed build or concurrent source edit never publishes reusable evidence", async () => {
  await withBuildFixture(async (directory, environment) => {
    const proof = path.join(directory, "coverage/verification-build.json");
    await assert.rejects(
      buildVerification({
        repository: directory,
        environment,
        build: async () => 7,
      }),
      /exit code 7/,
    );
    await assert.rejects(readFile(proof), { code: "ENOENT" });
    await assert.rejects(
      buildVerification({
        repository: directory,
        environment,
        build: async () => {
          await writeFile(
            path.join(directory, "src/app/App.tsx"),
            "concurrent source edit",
          );
          return 0;
        },
      }),
      /sources changed/,
    );
    await assert.rejects(readFile(proof), { code: "ENOENT" });
  });
});

test("rebuilding atomically replaces verification evidence without rewriting the previous file", async () => {
  await withBuildFixture(async (directory, environment) => {
    const coverage = path.join(directory, "coverage");
    const proof = path.join(coverage, "verification-build.json");
    const alias = path.join(coverage, "previous-evidence.json");
    await mkdir(coverage);
    await writeFile(proof, "previous evidence");
    await link(proof, alias);

    const previous =
      process.platform === "win32" ? null : await open(proof, "r");
    try {
      const identity = await buildVerification({
        repository: directory,
        environment,
        build: async () => 0,
      });
      if (previous)
        assert.equal(await previous.readFile("utf8"), "previous evidence");
      assert.equal(await readFile(alias, "utf8"), "previous evidence");
      assert.deepEqual(JSON.parse(await readFile(proof, "utf8")), identity);
      assert.deepEqual((await readdir(coverage)).sort(), [
        "previous-evidence.json",
        "verification-build.json",
      ]);
    } finally {
      await previous?.close();
    }
  });
});

test("verification publication rejects existing linked and directory destinations", async () => {
  await withBuildFixture(async (directory, environment) => {
    const coverage = path.join(directory, "coverage");
    const proof = path.join(coverage, "verification-build.json");
    const outside = path.join(coverage, "unrelated-directory");
    const build = () =>
      buildVerification({
        repository: directory,
        environment,
        build: async () => 0,
      });
    await mkdir(coverage);
    await mkdir(outside);
    await symlink(outside, proof, "junction");
    await assert.rejects(build(), /evidence must be an ordinary file/);
    assert.deepEqual(await readdir(outside), []);

    await rm(proof);
    await mkdir(proof);
    await assert.rejects(build(), /evidence must be an ordinary file/);
    assert.deepEqual(await readdir(proof), []);
    assert.deepEqual((await readdir(coverage)).sort(), [
      "unrelated-directory",
      "verification-build.json",
    ]);
  });
});

test("verification rejects modified or added distribution assets and linked outputs", async () => {
  await withBuildFixture(async (directory, environment) => {
    await buildVerification({
      repository: directory,
      environment,
      build: async () => 0,
    });
    await writeFile(path.join(directory, "dist/extra.js"), "unexpected output");
    await assert.rejects(
      verifyVerificationBuild(directory, environment),
      /stale/,
    );
    await rm(path.join(directory, "dist/extra.js"));
    await writeFile(path.join(directory, "dist/app.js"), "changed output");
    await assert.rejects(
      verifyVerificationBuild(directory, environment),
      /stale/,
    );
    await mkdir(path.join(directory, "coverage/outside"));
    await symlink(
      path.join(directory, "coverage/outside"),
      path.join(directory, "dist/linked"),
      "junction",
    );
    await assert.rejects(
      verifyVerificationBuild(directory, environment),
      /ordinary/,
    );
  });
});

test("verification operations retain their original error and post-operation integrity failure", async () => {
  await withBuildFixture(async (directory, environment) => {
    await buildVerification({
      repository: directory,
      environment,
      build: async () => 0,
    });
    const primary = new Error("synthetic original audit failure");
    await assert.rejects(
      withVerificationBuild(directory, environment, async () => {
        await writeFile(
          path.join(directory, "dist/app.js"),
          "changed during operation",
        );
        throw primary;
      }),
      (error) =>
        error instanceof AggregateError &&
        error.errors[0] === primary &&
        /stale/.test(error.errors[1].message),
    );
  });
});

test("source provenance includes App, providers, fonts and capture inputs without reading private files", async () => {
  const configuration = [
    ".nvmrc",
    "package.json",
    "package-lock.json",
    "index.html",
    "vite.config.ts",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "playwright.visual.config.ts",
    "scripts/run-visual.mjs",
    "scripts/visual-environment.mjs",
    "scripts/stamp-admin-build.mjs",
    "scripts/validate-production-env.mjs",
    "scripts/validate-deployment-env.mjs",
  ];
  const sourceFiles = [
    "src/app/App.tsx",
    "src/app/providers/antd/Antd.tsx",
    "src/assets/fonts/example.woff2",
    "src/shared/lib/dialog-focus.ts",
    "public/logo.svg",
    "e2e/shared/admin-fixtures.ts",
  ];
  const inventory = [
    ...configuration,
    ...sourceFiles,
    "docs/README.md",
    "e2e/visual/baselines/application/win32/metadata.json",
  ];
  assert.deepEqual(
    visualSourceInputs(inventory),
    [...configuration, ...sourceFiles].sort(),
  );
  for (const unsafe of [
    "../private",
    "src/../private",
    "src\\private",
    "/private",
  ])
    assert.throws(
      () => visualSourceInputs([...inventory, unsafe]),
      /safe unique/,
    );
  assert.throws(
    () => visualSourceInputs([...inventory, inventory[0]]),
    /safe unique/,
  );
  assert.throws(() => visualSourceInputs(sourceFiles), /missing/);
  assert.throws(
    () => visualSourceInputs([...inventory, "src/.env.local"]),
    /environment files/,
  );
  const directory = await mkdtemp(path.join(tmpdir(), "kernel-visual-inputs-"));
  try {
    await mkdir(path.join(directory, ".github"));
    await writeFile(
      path.join(directory, ".github/bootstrap-policy.json"),
      JSON.stringify({ allowedFiles: inventory }),
    );
    for (const file of [...configuration, ...sourceFiles]) {
      await mkdir(path.dirname(path.join(directory, file)), {
        recursive: true,
      });
      await writeFile(path.join(directory, file), `synthetic public ${file}`);
    }
    // Neither the private file nor the approved-image metadata needs to exist.
    const initial = await fingerprintVisualSources(directory);
    await writeFile(path.join(directory, "src/app/App.tsx"), "changed App");
    const changedApp = await fingerprintVisualSources(directory);
    assert.notEqual(changedApp.sourceFingerprint, initial.sourceFingerprint);
    await writeFile(
      path.join(directory, "src/assets/fonts/example.woff2"),
      "changed font",
    );
    const changedFont = await fingerprintVisualSources(directory);
    assert.notEqual(
      changedFont.sourceFingerprint,
      changedApp.sourceFingerprint,
    );
    assert.deepEqual(changedFont.sourceInputs, initial.sourceInputs);
    const outside = path.join(directory, "outside");
    await mkdir(outside);
    await writeFile(
      path.join(outside, "not-source.txt"),
      "synthetic outside file",
    );
    await symlink(outside, path.join(directory, "src/redirect"), "junction");
    await writeFile(
      path.join(directory, ".github/bootstrap-policy.json"),
      JSON.stringify({
        allowedFiles: [...inventory, "src/redirect/not-source.txt"],
      }),
    );
    await assert.rejects(
      fingerprintVisualSources(directory),
      /ordinary public file/,
    );
  } finally {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.equal(
      path.basename(directory).startsWith("kernel-visual-inputs-"),
      true,
    );
    await rm(directory, { recursive: true, force: true });
  }
});

test("the actual update command rejects CI before inspecting baselines or starting fixtures", async () => {
  const result = await runOwnedCommand(
    process.execPath,
    [fileURLToPath(new URL("./run-visual.mjs", import.meta.url)), "--update"],
    {
      env: {
        ...visualEnvironment({
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
        }),
        CI: "1",
      },
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Visual baseline updates are forbidden in CI/);
});

test("the actual visual config requires declared capture for update flags and forbids every CI update", async () => {
  const configuration = new URL(
    "../playwright.visual.config.ts",
    import.meta.url,
  );
  const flags = [
    "-u",
    "-u=all",
    "-uall",
    "--update-snapshots",
    "--update-snapshots=all",
  ];
  const scenarios = [
    { update: "0", ci: "", expected: "none" },
    { update: "1", ci: "", expected: "all" },
    {
      update: "1",
      ci: "1",
      error: /Visual baseline updates are forbidden in CI/,
    },
    ...flags.flatMap((flag) => [
      { flag, update: "0", ci: "", error: /require KERNEL_VISUAL_UPDATE=1/ },
      { flag, update: "1", ci: "", expected: "all" },
      {
        flag,
        update: "0",
        ci: "1",
        error: /Visual baseline updates are forbidden in CI/,
      },
      {
        flag,
        update: "1",
        ci: "1",
        error: /Visual baseline updates are forbidden in CI/,
      },
    ]),
  ];
  const repository = fileURLToPath(new URL("../", import.meta.url));
  for (const scenario of scenarios) {
    const label = JSON.stringify(scenario);
    const result = await runOwnedCommand(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          scenario.flag
            ? `process.argv.push(${JSON.stringify(scenario.flag)});`
            : "",
          `const configuration = await import(${JSON.stringify(configuration.href)});`,
          "console.log(configuration.default.updateSnapshots);",
        ].join("\n"),
      ],
      {
        env: {
          ...visualEnvironment({
            PATH: process.env.PATH,
            SystemRoot: process.env.SystemRoot,
          }),
          CI: scenario.ci,
          KERNEL_VISUAL_UPDATE: scenario.update,
          KERNEL_VISUAL_BASELINES:
            scenario.update === "1"
              ? path.join(
                  repository,
                  "coverage/visual/captures/candidate-synthetic",
                )
              : path.join(
                  repository,
                  "e2e/visual/baselines/application",
                  process.platform,
                ),
          KERNEL_VISUAL_RESULTS: path.join(
            repository,
            "coverage/visual/run-synthetic",
          ),
        },
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.ifError(result.error);
    if (scenario.error) {
      assert.notEqual(result.status, 0, label);
      assert.match(result.stderr, scenario.error, label);
    } else {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), scenario.expected, label);
    }
  }
});

test(
  "ordinary Windows short-name aliases retain reviewed image integrity",
  { skip: process.platform !== "win32" },
  async (context) => {
    const directory = await realpath(
      await mkdtemp(path.join(tmpdir(), "kernel-visual-short-name-")),
    );
    const bytes = Buffer.from("synthetic reviewed short-name image");
    const metadata = {
      images: [
        {
          name: "approved.png",
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
    };
    try {
      await writeFile(path.join(directory, "approved.png"), bytes);
      const result = await runOwnedCommand(
        "cmd.exe",
        [
          "/d",
          "/e:on",
          "/v:off",
          "/u",
          "/c",
          'for %I in ("%KERNEL_VISUAL_SHORT_QUERY_PATH%") do @echo "%~fsI"',
        ],
        {
          env: {
            ...visualEnvironment({
              PATH: process.env.PATH,
              SystemRoot: process.env.SystemRoot,
              TEMP: directory,
              TMP: directory,
            }),
            KERNEL_VISUAL_SHORT_QUERY_PATH: directory,
          },
          encoding: "utf16le",
          windowsVerbatimArguments: true,
          windowsHide: true,
        },
      );
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      const quotedAlias = result.stdout.trim();
      assert.match(quotedAlias, /^".+"$/u);
      const alias = quotedAlias.slice(1, -1);
      if (alias.toLowerCase() === directory.toLowerCase()) {
        context.skip("This Windows volume does not expose an 8.3 alias.");
        return;
      }
      assert.equal(await realpath(alias), directory);
      await assertVisualBaselineImages(alias, metadata);
    } finally {
      assert.equal(path.dirname(directory), await realpath(tmpdir()));
      assert.ok(
        path.basename(directory).startsWith("kernel-visual-short-name-"),
      );
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test(
  "the Windows fallback snapshots only descendants and verifies pinned identities before children-first termination",
  { skip: process.platform !== "win32" },
  async (context) => {
    const repository = fileURLToPath(new URL("../", import.meta.url));
    const coverage = path.join(
      repository,
      "coverage/governance/powershell.xml",
    );
    await mkdir(path.dirname(coverage), { recursive: true });
    const systemRoot = process.env.SystemRoot || String.raw`C:\Windows`;
    const powershell = path.win32.join(
      systemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );

    const result = await runOwnedCommand(
      powershell,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-File",
        fileURLToPath(
          new URL("./stop-visual-process-tree.test.ps1", import.meta.url),
        ),
        "-CoveragePath",
        coverage,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
      },
      (chunk) => context.diagnostic(chunk.trimEnd()),
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "synthetic-owned-tree-fallback-passed");
    const measured = await readFile(coverage, "utf8");
    assert.ok(
      measured.includes('<file path="scripts/stop-visual-process-tree.ps1">'),
    );
    assert.match(measured, /<lineToCover lineNumber="\d+" covered="true"/);
  },
);

test("the visual CLI binds a pending capture to its public sources and synthetic child", async () => {
  const repository = fileURLToPath(new URL("../", import.meta.url));
  const script = fileURLToPath(new URL("./run-visual.mjs", import.meta.url));
  const baseline = path.join(
    repository,
    "e2e/visual/baselines/application/win32/metadata.json",
  );
  const baselineBefore = await readFile(baseline);
  const fixtureKey = Symbol.for("kernel-admin.visual-cli.synthetic");
  const fixture = {
    children: [],
    browsers: [],
    executable: path.join(repository, "synthetic-browser/chrome.exe"),
  };
  globalThis[fixtureKey] = fixture;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "node:child_process")
        return { url: "kernel-visual:child", shortCircuit: true };
      if (specifier === "@playwright/test")
        return { url: "kernel-visual:browser", shortCircuit: true };
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === "kernel-visual:child")
        return {
          format: "module",
          shortCircuit: true,
          source: [
            'import { EventEmitter } from "node:events";',
            'const fixture = globalThis[Symbol.for("kernel-admin.visual-cli.synthetic")];',
            'export function execFile() { throw new Error("Unexpected process-tree cleanup in the synthetic successful run"); }',
            "export function spawn(command, args, options) {",
            "  fixture.children.push({ command, args, options });",
            "  const child = new EventEmitter();",
            "  child.pid = 123;",
            "  child.kill = () => true;",
            '  queueMicrotask(() => child.emit("close", 0));',
            "  return child;",
            "}",
          ].join("\n"),
        };
      if (url === "kernel-visual:browser")
        return {
          format: "module",
          shortCircuit: true,
          source: [
            'const fixture = globalThis[Symbol.for("kernel-admin.visual-cli.synthetic")];',
            "export const chromium = {",
            "  executablePath: () => fixture.executable,",
            "  launch: async (options) => {",
            "    const call = { options, closed: false };",
            "    fixture.browsers.push(call);",
            "    return {",
            '      version: () => "synthetic-chromium-version",',
            "      close: async () => { call.closed = true; },",
            "    };",
            "  },",
            "};",
          ].join("\n"),
        };
      return nextLoad(url, context);
    },
  });
  const original = {
    argv: process.argv,
    ci: process.env.CI,
    exitCode: process.exitCode,
    info: console.info,
    error: console.error,
  };
  const messages = [],
    errors = [];
  let captureDirectory, resultDirectory;
  try {
    process.argv = [process.execPath, script, "--update"];
    process.env.CI = "";
    process.exitCode = undefined;
    console.info = (message) => messages.push(message);
    console.error = (message) => errors.push(message);
    await import(
      new URL("./run-visual.mjs?synthetic-cli-wiring", import.meta.url)
    );

    assert.deepEqual(errors, []);
    assert.equal(process.exitCode, 0);
    assert.equal(fixture.children.length, 1);
    assert.equal(fixture.browsers.length, 1);
    assert.equal(fixture.browsers[0].closed, true);
    assert.equal(
      fixture.browsers[0].options.executablePath,
      fixture.executable,
    );
    assert.equal(fixture.browsers[0].options.headless, true);
    const child = fixture.children[0];
    assert.equal(child.command, process.execPath);
    assert.equal(child.options.cwd, repository);
    assert.equal(Object.hasOwn(child.options, "timeout"), false);
    assert.equal(child.options.windowsHide, true);
    assert.equal(child.options.stdio, "inherit");
    assert.deepEqual(child.args.slice(1), [
      "test",
      "--config=playwright.visual.config.ts",
      "--update-snapshots",
    ]);
    assert.equal(
      child.options.env.VITE_API_BASE_URL,
      "https://api.example.com",
    );
    assert.equal(child.options.env.KERNEL_SYNTHETIC_ENV, "1");
    assert.equal(child.options.env.KERNEL_VISUAL_RUNNER, "1");
    assert.equal(child.options.env.KERNEL_VISUAL_UPDATE, "1");
    captureDirectory = child.options.env.KERNEL_VISUAL_BASELINES;
    resultDirectory = child.options.env.KERNEL_VISUAL_RESULTS;
    const pending = JSON.parse(
      await readFile(path.join(captureDirectory, "metadata.json"), "utf8"),
    );
    const result = JSON.parse(
      await readFile(path.join(resultDirectory, "environment.json"), "utf8"),
    );
    assert.deepEqual(pending.review, {
      status: "pending",
      reviewer: null,
      reviewedAt: null,
    });
    assert.equal(result.mode, "update");
    assert.equal(result.exitCode, 0);
    assert.equal(result.captureDirectory, captureDirectory);
    assert.equal(result.browserVersion, "synthetic-chromium-version");
    assert.deepEqual(result.review, pending.review);
    assert.equal(result.sourceFingerprint, pending.sourceFingerprint);
    assert.match(result.sourceFingerprint, /^[a-f0-9]{64}$/);
    assert.deepEqual(
      result.sourceInputs,
      (await fingerprintVisualSources(repository)).sourceInputs,
    );
    assert.equal(
      result.sourceInputs.some((file) => /(?:^|\/)\.env(?:\.|$)/i.test(file)),
      false,
    );
    assert.match(messages.join("\n"), /captures remain pending/);
    assert.deepEqual(await readFile(baseline), baselineBefore);
    const release = await acquireVisualLock(
      path.join(repository, "coverage/visual"),
    );
    await release();
  } finally {
    process.argv = original.argv;
    if (original.ci === undefined) delete process.env.CI;
    else process.env.CI = original.ci;
    process.exitCode = original.exitCode;
    console.info = original.info;
    console.error = original.error;
    hooks.deregister();
    delete globalThis[fixtureKey];
    if (captureDirectory) {
      assert.equal(
        path.dirname(path.resolve(captureDirectory)),
        path.resolve(repository, "coverage/visual/captures"),
      );
      assert.equal(
        path.basename(captureDirectory).startsWith("candidate-"),
        true,
      );
      await rm(captureDirectory, { recursive: true, force: true });
    }
    if (resultDirectory) {
      assert.equal(
        path.dirname(path.resolve(resultDirectory)),
        path.resolve(repository, "coverage/visual"),
      );
      assert.equal(path.basename(resultDirectory).startsWith("run-"), true);
      await rm(resultDirectory, { recursive: true, force: true });
    }
  }
});
