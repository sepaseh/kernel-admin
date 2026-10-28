import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { commandArguments, runProfile } from "./validate.mjs";

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
  assert.equal(manifest.phase, "storybook-verification");
  assert.equal(required.length, 11);
  assert.deepEqual(
    required.slice(-2).map(({ command, id }) => ({ command, id })),
    [
      { command: "npm run build-storybook", id: "storybook-build" },
      { command: "npm run test:storybook", id: "storybook-browser" },
    ],
  );
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
