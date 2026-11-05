import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { requiredCheckCommands } from "./check-ci.mjs";
import { commandArguments, executeProfile, runProfile } from "./validate.mjs";

const applicationChecks = [
  { id: "unused", command: "npm run check:unused" },
  { id: "application-build", command: "npm run build:verification" },
  { id: "bundle", command: "npm run check:bundle" },
  { id: "contract", command: "npm run test:contract" },
  { id: "application-e2e", command: "npm run test:e2e" },
];
const inheritedCommands = [
  ["snapshot", "npm run check:snapshot"],
  ["ci-policy", "npm run check:ci"],
  ["guidance", "npm run check:guidance"],
  ["audit", "npm run audit"],
  ["boundaries", "npm run check:boundaries"],
  ["typecheck", "npm run typecheck"],
  ["lint", "npm run lint"],
  ["format", "npm run format:check"],
  ["unit-coverage", "npm run test:coverage"],
  ["governance-coverage", "npm run test:governance"],
  ["storybook-build", "npm run build-storybook"],
  ["storybook-browser", "npm run test:storybook"],
];
const phaseCounts = new Map([
  ...[
    "governance",
    "repository-foundation",
    "foundation",
    "catalogs",
    "runtime-localization",
    "http-lifecycle",
    "ui-foundation",
    "core-auth",
    "business-screens",
  ].map((phase) => [phase, 10]),
  ["storybook-verification", 12],
  ["assistant-guidance", 12],
  ["release-prerequisites", 12],
  ["application-verification", 17],
]);
const historicalManifest = () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../.agents/validation.json", import.meta.url),
      "utf8",
    ),
  );
  const checks = inheritedCommands.map(
    ([id, command]) =>
      manifest.checks.find((check) => check.id === id) ?? {
        id,
        command,
        kind: "required",
        ciJobs: ["check"],
        scopes: ["assistant-guidance"],
      },
  );
  return {
    ...manifest,
    phase: "assistant-guidance",
    applicationReady: false,
    checks,
    profiles: {
      ...manifest.profiles,
      full: checks
        .filter((check) => check.kind === "required")
        .map((check) => check.id),
    },
  };
};

test("Storybook uses its isolated synthetic Vite configuration without ambient files or process VITE variables", async () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../.agents/validation.json", import.meta.url),
      "utf8",
    ),
  );
  if (phaseCounts.get(manifest.phase) < 12) {
    assert.equal(
      manifest.checks.some((check) => check.id.startsWith("storybook-")),
      false,
    );
    return;
  }
  const [{ default: vite }, { default: storybook }] = await Promise.all([
    import("../.storybook/vite.config.ts"),
    import("../.storybook/main.ts"),
  ]);
  assert.equal(vite.envDir, false);
  assert.deepEqual(vite.envPrefix, []);
  assert.equal(vite.publicDir, false);
  assert.deepEqual(vite.define, {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/__storybook_api__"),
    "import.meta.env.VITE_OBSERVABILITY_URL": JSON.stringify(""),
    "import.meta.env.VITE_RELEASE_ID": JSON.stringify("synthetic-storybook"),
  });
  assert.equal(
    vite.resolve.alias["@"],
    fileURLToPath(new URL("../src", import.meta.url)),
  );
  assert.equal(
    storybook.core.builder.options.viteConfigPath,
    fileURLToPath(new URL("../.storybook/vite.config.ts", import.meta.url)),
  );
  assert.deepEqual(storybook.staticDirs, ["../public"]);
  assert.deepEqual(storybook.stories, ["../src/**/*.stories.@(ts|tsx)"]);
});

test("the current full gate executes every published required check in declared order", () => {
  const read = (file) =>
    readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const manifest = JSON.parse(read(".agents/validation.json"));
  const publication = JSON.parse(read(".github/bootstrap-policy.json"));
  const pkg = JSON.parse(read("package.json"));
  const required = manifest.checks.filter((check) => check.kind === "required");
  assert.equal(manifest.phase, publication.phase);
  assert.equal(manifest.applicationReady, publication.applicationReady);
  const expected = requiredCheckCommands(manifest);
  const count = expected.length;
  const application = manifest.phase === "application-verification";
  assert.equal(manifest.applicationReady, application);
  assert.equal(required.length, count);
  assert.deepEqual(
    required.map(({ id, command }) => [id, command]),
    expected,
  );
  const inherited = historicalManifest().checks.filter(
    (check) => check.kind === "required",
  );
  const historicalRequired = required.filter(
    (check) => check.id !== "actions-lint",
  );
  const historicalCount = phaseCounts.get(manifest.phase);
  assert.equal(inherited.length, 12);
  assert.deepEqual(
    historicalRequired.slice(0, Math.min(12, historicalCount)),
    inherited.slice(0, Math.min(12, historicalCount)),
  );
  assert.deepEqual(
    historicalRequired
      .slice(10, 12)
      .map(({ command, id }) => ({ command, id })),
    historicalCount >= 12
      ? [
          { command: "npm run build-storybook", id: "storybook-build" },
          { command: "npm run test:storybook", id: "storybook-browser" },
        ]
      : [],
  );
  assert.deepEqual(
    historicalRequired.slice(12).map(({ command, id }) => ({ command, id })),
    application ? applicationChecks : [],
  );
  assert.equal(
    pkg.scripts["check:guidance"],
    "node scripts/check-guidance.mjs",
  );
  for (const file of [
    "scripts/check-guidance.test.mjs",
    "scripts/block-dangerous.test.mjs",
    "scripts/post-edit-format.test.mjs",
    "scripts/quality-gate.test.mjs",
  ])
    if (publication.allowedFiles.includes(file))
      assert.ok(pkg.scripts["test:governance"].includes(file));
  if (historicalCount >= 12) {
    assert.equal(
      pkg.scripts["build-storybook"],
      "storybook build --output-dir coverage/storybook-static",
    );
    assert.equal(
      pkg.scripts["test:storybook"],
      "vitest run --config vitest.storybook.config.ts",
    );
  }
  assert.equal(
    pkg.scripts["browser:install"],
    "playwright install --with-deps chromium",
  );
  assert.deepEqual(
    manifest.profiles.full,
    required.map((check) => check.id),
  );
  assert.equal(new Set(manifest.profiles.full).size, required.length);
  const commands = required.map((check) => check.command);
  for (const command of commands) {
    const [, script] = commandArguments(command);
    assert.equal(typeof pkg.scripts[script], "string");
  }
  const executed = [];
  assert.equal(
    runProfile(manifest, "full", (args) => {
      executed.push(args);
      return 0;
    }),
    0,
  );
  assert.deepEqual(executed, commands.map(commandArguments));
});
test("the historical twelve-check fixture executes every inherited command without application checks", () => {
  const manifest = historicalManifest();
  const required = manifest.checks.filter((check) => check.kind === "required");
  assert.equal(manifest.phase, "assistant-guidance");
  assert.equal(manifest.applicationReady, false);
  assert.equal(required.length, 12);
  assert.deepEqual(
    manifest.profiles.full,
    required.map((check) => check.id),
  );
  assert.deepEqual(manifest.profiles.full.slice(10), [
    "storybook-build",
    "storybook-browser",
  ]);
  const executed = [];
  assert.equal(
    runProfile(manifest, "full", (args) => {
      executed.push(args);
      return 0;
    }),
    0,
  );
  assert.deepEqual(
    executed,
    required.map((check) => commandArguments(check.command)),
  );
});

test("every staged phase executes all of its declared required checks and rejects each omission", () => {
  for (const [phase, count] of phaseCounts) {
    const value = historicalManifest();
    value.phase = phase;
    value.applicationReady = phase === "application-verification";
    value.checks.push(
      ...applicationChecks.map((check) => ({ ...check, kind: "required" })),
    );
    value.checks = value.checks.slice(0, count);
    value.profiles.full = value.checks.map((check) => check.id);
    const executed = [];
    assert.equal(
      runProfile(value, "full", (_args, check) => {
        executed.push(check.id);
        return 0;
      }),
      0,
    );
    assert.deepEqual(executed, value.profiles.full);
    for (const id of value.profiles.full) {
      const incomplete = structuredClone(value);
      incomplete.profiles.full = incomplete.profiles.full.filter(
        (check) => check !== id,
      );
      const omitted = [];
      assert.throws(
        () =>
          runProfile(incomplete, "full", (_args, check) => {
            omitted.push(check.id);
            return 0;
          }),
        /every required check exactly once/,
      );
      assert.deepEqual(omitted, []);
    }
  }
});

test("the future seventeen-check fixture retains the inherited gate and rejects every omitted application check before execution", () => {
  const manifest = historicalManifest();
  manifest.phase = "application-verification";
  manifest.applicationReady = true;
  manifest.checks.push(
    ...applicationChecks.map((check) => ({ ...check, kind: "required" })),
  );
  manifest.profiles.full.push(...applicationChecks.map((check) => check.id));
  assert.equal(
    manifest.checks.filter((check) => check.kind === "required").length,
    17,
  );
  assert.equal(manifest.profiles.full.length, 17);
  assert.deepEqual(manifest.profiles.full.slice(10, 12), [
    "storybook-build",
    "storybook-browser",
  ]);
  assert.deepEqual(
    manifest.profiles.full.slice(12),
    applicationChecks.map((check) => check.id),
  );
  const executed = [];
  assert.equal(
    runProfile(manifest, "full", (args) => {
      executed.push(args);
      return 0;
    }),
    0,
  );
  assert.deepEqual(executed, [
    ...historicalManifest()
      .checks.filter((check) => check.kind === "required")
      .map((check) => commandArguments(check.command)),
    ...applicationChecks.map((check) => commandArguments(check.command)),
  ]);
  for (const missing of applicationChecks) {
    const incomplete = structuredClone(manifest);
    incomplete.profiles.full = incomplete.profiles.full.filter(
      (id) => id !== missing.id,
    );
    const omittedExecution = [];
    assert.throws(
      () =>
        runProfile(incomplete, "full", (args) => omittedExecution.push(args)),
      /every required check exactly once/,
    );
    assert.deepEqual(omittedExecution, []);
  }
});

test("validation runner preserves arguments without a shell", () => {
  assert.deepEqual(commandArguments("npm run test:e2e -- --project=chromium"), [
    "run",
    "test:e2e",
    "--",
    "--project=chromium",
  ]);
  for (const command of [
    "npm run lint && git push",
    "npm run lint; echo bad",
    "node script.mjs",
    "npm run lint | cat",
    "npm run lint > output",
    "npm run lint $SECRET",
    "npm run test --workspace=other",
    "npm run test --workspaces",
    "npm run test --prefix=../other",
    "npm run --workspaces test",
    "npm run --prefix ../other test",
    "npm run --prefix=../other test",
    "npm run -w other test",
    "npm run test -w other",
    "npm run test -w=other",
    "npm run test -wother",
    "npm run test -C ../other",
    "npm run test --pref=../other",
    "npm run test positional",
  ])
    assert.throws(() => commandArguments(command));
});
test("validation runner accepts script names and forwards root-looking script arguments after the separator", () => {
  for (const script of [
    "test",
    "type-check",
    "test:coverage",
    "_internal",
    "2fa",
  ])
    assert.deepEqual(commandArguments(`npm run ${script}`), ["run", script]);
  assert.deepEqual(
    commandArguments("npm run test -- --prefix=fixture -w value -C fixture"),
    ["run", "test", "--", "--prefix=fixture", "-w", "value", "-C", "fixture"],
  );
  assert.deepEqual(commandArguments("npm run test -- \"two words\" ''"), [
    "run",
    "test",
    "--",
    "two words",
    "",
  ]);
});
test("validation profiles stop at the first failed required command", () => {
  const manifest = {
    checks: [
      { id: "first", command: "npm run lint", kind: "required" },
      { id: "second", command: "npm run typecheck", kind: "required" },
    ],
    profiles: { full: ["first", "second"] },
  };
  const seen = [];
  assert.equal(
    runProfile(manifest, "full", (_args, check) => {
      seen.push(check.id);
      return 7;
    }),
    7,
  );
  assert.deepEqual(seen, ["first"]);
  assert.throws(() => runProfile(manifest, "missing", () => 0), /Unknown/);
  assert.throws(
    () =>
      runProfile(
        { ...manifest, profiles: { full: ["unknown"] } },
        "full",
        () => 0,
      ),
    /Unknown validation check/,
  );
});

const typecheckBuildManifest = () => ({
  checks: [
    { id: "typecheck", command: "npm run typecheck", kind: "required" },
    { id: "lint", command: "npm run lint", kind: "required" },
    {
      id: "application-build",
      command: "npm run build:verification",
      kind: "required",
    },
  ],
  profiles: { full: ["typecheck", "lint", "application-build"] },
});

test("the coordinator passes only its own successful same-source typecheck to the build", async () => {
  const calls = [];
  const fingerprint = "a".repeat(64);
  assert.equal(
    await executeProfile(
      typecheckBuildManifest(),
      "full",
      (args, check) => {
        calls.push({ id: check.id, args });
        return 0;
      },
      async () => fingerprint,
    ),
    0,
  );
  assert.deepEqual(calls, [
    { id: "typecheck", args: ["run", "typecheck"] },
    { id: "lint", args: ["run", "lint"] },
    {
      id: "application-build",
      args: [
        "run",
        "build:verification",
        "--",
        "--typechecked-source",
        fingerprint,
      ],
    },
  ]);
});

const ciBuildManifest = () => ({
  checks: [
    { id: "typecheck", command: "npm run typecheck", kind: "required" },
    {
      id: "application-build",
      command: "npm run build:verification",
      kind: "required",
    },
    { id: "bundle", command: "npm run check:bundle", kind: "required" },
  ],
  profiles: { "ci-build": ["typecheck", "application-build", "bundle"] },
});

test("ci-build checks types once and shares its matching proof and completed build", async () => {
  const calls = [];
  const fingerprint = "a".repeat(64);
  assert.equal(
    await executeProfile(
      ciBuildManifest(),
      "ci-build",
      (args, check, options) => {
        calls.push({ id: check.id, args, ...options });
        return 0;
      },
      async () => fingerprint,
    ),
    0,
  );
  assert.deepEqual(calls, [
    {
      id: "typecheck",
      args: ["run", "typecheck"],
      reusableBuild: false,
    },
    {
      id: "application-build",
      args: [
        "run",
        "build:verification",
        "--",
        "--typechecked-source",
        fingerprint,
      ],
      reusableBuild: false,
    },
    {
      id: "bundle",
      args: ["run", "check:bundle"],
      reusableBuild: true,
    },
  ]);
});

test("ci-build rejects stale or malformed typecheck proof before building", async () => {
  for (const fingerprints of [
    ["a".repeat(64), "b".repeat(64)],
    ["a".repeat(64), "a".repeat(64), "b".repeat(64)],
    ["invalid"],
  ]) {
    const calls = [];
    await assert.rejects(
      executeProfile(
        ciBuildManifest(),
        "ci-build",
        (_args, check) => {
          calls.push(check.id);
          return 0;
        },
        async () => fingerprints.shift(),
      ),
      /Source changed/,
    );
    assert.deepEqual(calls, ["typecheck"]);
  }
});

test("ci-build stops after a failed typecheck and cannot borrow a different command", async () => {
  const failed = [];
  assert.equal(
    await executeProfile(
      ciBuildManifest(),
      "ci-build",
      (_args, check) => {
        failed.push(check.id);
        return 7;
      },
      async () => "a".repeat(64),
    ),
    7,
  );
  assert.deepEqual(failed, ["typecheck"]);

  for (const [index, command] of [
    [0, "npm run typecheck:other"],
    [1, "npm run build"],
  ]) {
    const manifest = ciBuildManifest();
    manifest.checks[index].command = command;
    const calls = [];
    assert.equal(
      await executeProfile(
        manifest,
        "ci-build",
        (args) => {
          calls.push(args);
          return 0;
        },
        async () => {
          throw new Error("A different command cannot supply typecheck proof");
        },
      ),
      0,
    );
    assert.deepEqual(
      calls,
      manifest.checks.map((check) => commandArguments(check.command)),
    );
  }
});

test("full and complete coordination preserve each declared check exactly once", async () => {
  const manifest = historicalManifest();
  manifest.applicationReady = true;
  manifest.phase = "application-verification";
  manifest.checks.push(
    ...applicationChecks.map((check) => ({ ...check, kind: "required" })),
    {
      id: "browser-compatibility",
      command: "npm run test:e2e:complete",
      kind: "manual",
    },
    { id: "visual", command: "npm run test:visual", kind: "manual" },
  );
  manifest.profiles.full = manifest.checks
    .filter((check) => check.kind === "required")
    .map((check) => check.id);
  manifest.profiles.complete = [
    ...manifest.profiles.full.slice(0, -1),
    "browser-compatibility",
    "visual",
  ];
  await Promise.all(
    ["full", "complete"].map(async (profile) => {
      const calls = [];
      assert.equal(
        await executeProfile(
          manifest,
          profile,
          (args, check, options) => {
            calls.push({ args, id: check.id, ...options });
            return 0;
          },
          async () => "a".repeat(64),
        ),
        0,
      );
      assert.deepEqual(
        calls.map(({ id }) => id),
        manifest.profiles[profile],
      );
      assert.equal(calls.filter(({ id }) => id === "typecheck").length, 1);
      assert.deepEqual(
        calls
          .filter(({ args }) => args.includes("--typechecked-source"))
          .map(({ id }) => id),
        ["application-build"],
      );
      assert.equal(calls.find(({ id }) => id === "bundle").reusableBuild, true);
    }),
  );
});

test("a failed required typecheck stops verification before any build", async () => {
  const calls = [];
  assert.equal(
    await executeProfile(
      typecheckBuildManifest(),
      "full",
      (_args, check) => {
        calls.push(check.id);
        return 7;
      },
      async () => "a".repeat(64),
    ),
    7,
  );
  assert.deepEqual(calls, ["typecheck"]);
});

test("source edits during or after typecheck cannot borrow that successful result", async () => {
  await Promise.all(
    ["typecheck", "lint"].map(async (changedAt) => {
      let fingerprint = "a".repeat(64);
      const calls = [];
      await assert.rejects(
        executeProfile(
          typecheckBuildManifest(),
          "full",
          (_args, check) => {
            calls.push(check.id);
            if (check.id === changedAt) fingerprint = "b".repeat(64);
            return 0;
          },
          async () => fingerprint,
        ),
        /Source changed/,
      );
      assert.equal(calls.includes("application-build"), false);
    }),
  );
});

test("a focused build retains its standalone typecheck without an inherited proof", async () => {
  const manifest = typecheckBuildManifest();
  manifest.profiles.focused = ["application-build"];
  const calls = [];
  assert.equal(
    await executeProfile(
      manifest,
      "focused",
      (args) => {
        calls.push(args);
        return 0;
      },
      async () => {
        throw new Error("A standalone build has no coordinator typecheck");
      },
    ),
    0,
  );
  assert.deepEqual(calls, [["run", "build:verification"]]);
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const publication = JSON.parse(
    readFileSync(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  if (!publication.applicationReady) {
    assert.equal(
      JSON.parse(
        readFileSync(
          new URL("../.agents/validation.json", import.meta.url),
          "utf8",
        ),
      ).checks.some((check) => check.id === "application-build"),
      false,
    );
    return;
  }
  assert.equal(
    pkg.scripts.build,
    "npm run check:production-env && npm run typecheck && vite build && node scripts/stamp-admin-build.mjs",
  );
  assert.equal(
    pkg.scripts["build:verification"],
    "node scripts/run-visual.mjs --build",
  );
  assert.equal(
    pkg.scripts["build:verification:assets"],
    pkg.scripts.build.replace("npm run typecheck && ", ""),
  );
});

const mixedManifest = () => ({
  checks: [
    { id: "types", command: "npm run typecheck", kind: "required" },
    { id: "tests", command: "npm run test", kind: "required" },
    { id: "lab", command: "npm run lighthouse", kind: "advisory" },
    { id: "deploy", command: "npm run deploy", kind: "manual" },
  ],
  profiles: {
    full: ["types", "tests"],
    focused: ["tests"],
    operator: ["lab", "deploy"],
  },
});

test("full validation rejects omitted, repeated or non-required checks before execution", () => {
  for (const ids of [
    ["types"],
    ["types", "types", "tests"],
    ["types", "lab"],
    ["types", "deploy"],
    ["types", "tests", "lab"],
    ["types", "tests", "deploy"],
  ]) {
    const manifest = mixedManifest();
    manifest.profiles.full = ids;
    const executed = [];
    assert.throws(
      () => runProfile(manifest, "full", (args) => executed.push(args)),
      /every required check exactly once|must not repeat/,
    );
    assert.deepEqual(executed, []);
  }
});

test("validation rejects duplicate check definitions instead of silently selecting the last one", () => {
  const manifest = mixedManifest();
  manifest.checks.push({
    id: "types",
    command: "npm run skipped-types",
    kind: "required",
  });
  let runs = 0;
  assert.throws(
    () => runProfile(manifest, "focused", () => runs++),
    /unique IDs/,
  );
  assert.equal(runs, 0);
});

test("validation rejects malformed definitions and unknown later entries before any command runs", () => {
  for (const checks of [
    undefined,
    [],
    [undefined],
    [{ id: " ", command: "npm run test", kind: "required" }],
    [{ id: "types", command: "npm run test", kind: "optional" }],
  ]) {
    let runs = 0;
    assert.throws(() =>
      runProfile({ ...mixedManifest(), checks }, "full", () => {
        runs++;
        return 0;
      }),
    );
    assert.equal(runs, 0);
  }
  for (const profile of [
    ["types", "missing"],
    ["types", "types"],
  ]) {
    const manifest = mixedManifest();
    manifest.profiles.focused = profile;
    let runs = 0;
    assert.throws(() =>
      runProfile(manifest, "focused", () => {
        runs++;
        return 0;
      }),
    );
    assert.equal(runs, 0);
  }
  const manifest = mixedManifest();
  manifest.checks[1].command = "npm run test && git push";
  let runs = 0;
  assert.throws(() =>
    runProfile(manifest, "full", () => {
      runs++;
      return 0;
    }),
  );
  assert.equal(runs, 0);
});

test("focused profiles keep their explicit scope and may include manual or advisory checks", () => {
  const manifest = mixedManifest();
  const executed = [];
  assert.equal(
    runProfile(manifest, "focused", (_args, check) => {
      executed.push(check.id);
      return 0;
    }),
    0,
  );
  assert.deepEqual(executed, ["tests"]);
  executed.length = 0;
  assert.equal(
    runProfile(manifest, "operator", (_args, check) => {
      executed.push(check.id);
      return 0;
    }),
    0,
  );
  assert.deepEqual(executed, ["lab", "deploy"]);
});

test("complete verification retains core checks and replaces the Chromium suite rather than repeating it", () => {
  const declared = historicalManifest();
  declared.applicationReady = true;
  declared.phase = "application-verification";
  declared.checks.push(
    ...applicationChecks.map((check) => ({ ...check, kind: "required" })),
    {
      id: "browser-compatibility",
      command: "npm run test:e2e:complete",
      kind: "manual",
    },
    { id: "visual", command: "npm run test:visual", kind: "manual" },
  );
  declared.profiles.full = declared.checks
    .filter((check) => check.kind === "required")
    .map((check) => check.id);
  declared.profiles.complete = [
    ...declared.profiles.full.slice(0, -1),
    "browser-compatibility",
    "visual",
  ];
  const executed = [];
  assert.equal(
    runProfile(declared, "complete", (_args, check) => {
      executed.push(check.id);
      return 0;
    }),
    0,
  );
  assert.deepEqual(executed, [
    ...declared.profiles.full.slice(0, -1),
    "browser-compatibility",
    "visual",
  ]);
  for (const ids of [
    declared.profiles.complete.filter((id) => id !== "visual"),
    [...declared.profiles.complete, "application-e2e"],
    declared.profiles.complete.filter((id) => id !== "contract"),
    [...declared.profiles.complete].reverse(),
  ]) {
    const value = structuredClone(declared);
    value.profiles.complete = ids;
    const seen = [];
    assert.throws(
      () =>
        runProfile(value, "complete", (_args, check) => seen.push(check.id)),
      /Complete verification/,
    );
    assert.deepEqual(seen, []);
  }
});

test("an advisory profile still returns its observed failure instead of claiming a local pass", () => {
  const value = mixedManifest();
  value.profiles.performance = ["lab"];
  assert.equal(
    runProfile(value, "performance", () => 9),
    9,
  );
});
