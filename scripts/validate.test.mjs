import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { commandArguments, runProfile } from "./validate.mjs";

const applicationChecks = [
  { id: "unused", command: "npm run check:unused" },
  { id: "application-build", command: "npm run build" },
  { id: "bundle", command: "npm run check:bundle" },
  { id: "contract", command: "npm run test:contract" },
  { id: "application-e2e", command: "npm run test:e2e" },
  { id: "visual", command: "npm run test:visual" },
  { id: "lighthouse", command: "npm run test:lighthouse" },
];
const historicalManifest = () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../.agents/validation.json", import.meta.url),
      "utf8",
    ),
  );
  const checks = manifest.checks.filter((check) =>
    check.scopes.includes("assistant-guidance"),
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
  assert.ok(
    ["assistant-guidance", "application-verification"].includes(manifest.phase),
  );
  const application = manifest.phase === "application-verification";
  assert.equal(manifest.applicationReady, application);
  assert.equal(required.length, application ? 19 : 12);
  const inherited = historicalManifest().checks.filter(
    (check) => check.kind === "required",
  );
  assert.equal(inherited.length, 12);
  assert.deepEqual(required.slice(0, 12), inherited);
  assert.deepEqual(
    required.slice(10, 12).map(({ command, id }) => ({ command, id })),
    [
      { command: "npm run build-storybook", id: "storybook-build" },
      { command: "npm run test:storybook", id: "storybook-browser" },
    ],
  );
  assert.deepEqual(
    required.slice(12).map(({ command, id }) => ({ command, id })),
    application ? applicationChecks : [],
  );
  assert.equal(
    pkg.scripts["check:guidance"],
    "node scripts/check-guidance.mjs",
  );
  for (const file of [
    "scripts/guidance.test.mjs",
    "scripts/ai-hooks.portable.test.mjs",
    "scripts/ai-hooks.test.mjs",
  ])
    assert.ok(pkg.scripts["test:governance"].includes(file));
  assert.equal(
    pkg.scripts["build-storybook"],
    "storybook build --output-dir coverage/storybook-static",
  );
  assert.equal(
    pkg.scripts["test:storybook"],
    "vitest run --config vitest.storybook.config.ts",
  );
  assert.equal(
    pkg.scripts["browser:install"],
    application
      ? "playwright install --with-deps chromium firefox webkit"
      : "playwright install --with-deps chromium",
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

test("the future nineteen-check fixture retains the inherited gate and rejects every omitted application check before execution", () => {
  const manifest = historicalManifest();
  manifest.phase = "application-verification";
  manifest.applicationReady = true;
  manifest.checks.push(
    ...applicationChecks.map((check) => ({ ...check, kind: "required" })),
  );
  manifest.profiles.full.push(...applicationChecks.map((check) => check.id));
  assert.equal(
    manifest.checks.filter((check) => check.kind === "required").length,
    19,
  );
  assert.equal(manifest.profiles.full.length, 19);
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
