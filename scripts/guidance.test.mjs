import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { stringify } from "yaml";

import {
  checkGuidance,
  isSafeGuidancePath,
  markdownLinks,
  validateManifest,
  validateNavigation,
  validateStandaloneLockfile,
  validateStandaloneManifest,
} from "./check-guidance.mjs";

const fixture = () => {
  const manifest = {
    schemaVersion: 1,
    checks: [
      {
        id: "types",
        command: "npm run typecheck",
        kind: "required",
        ciJobs: ["check"],
        scopes: ["all"],
      },
      {
        id: "lab",
        command: "npm run lighthouse",
        kind: "advisory",
        ciJobs: [],
        scopes: ["focused"],
      },
    ],
    profiles: { full: ["types"], guidance: ["types", "lab"] },
  };
  const settings = {
    rules: [],
    skills: [],
    optionalHooks: [],
    navigation: ".agents/navigation.json",
    validation: ".agents/validation.json",
    evaluation: ".agents/evaluation/cases.json",
    recommendedChecks: ["npm run typecheck"],
    recommendedChecksSource: {
      path: ".agents/validation.json",
      profile: "full",
    },
  };
  const commands = [
    { run: "npm ci" },
    { run: "npm run browser:install" },
    { run: "npm run validate -- full" },
  ];
  const ci = {
    on: { pull_request: null },
    jobs: { check: { steps: structuredClone(commands) } },
  };
  const sonar = {
    on: { pull_request: null },
    jobs: {
      analysis: {
        steps: [
          ...structuredClone(commands),
          { uses: "SonarSource/sonarqube-scan-action@" + "a".repeat(40) },
        ],
      },
    },
  };
  return { manifest, settings, ci, sonar };
};
const workflows = ({ ci, sonar }) => ({
  CI: stringify(ci),
  Sonar: stringify(sonar),
});
const inspect = (state) =>
  validateManifest(state.manifest, state.settings, workflows(state));

test("Markdown scanning preserves consumed nonempty targets and ignores empty or unfinished links", () => {
  assert.deepEqual(
    markdownLinks("[one](owner.ts) []() [nested](two](part) [unfinished](tail"),
    ["owner.ts", "two](part"],
  );
  assert.deepEqual(markdownLinks("]()](next.md)"), ["next.md"]);
  assert.deepEqual(markdownLinks("ordinary prose"), []);
});

test("malformed Markdown delimiter runs finish within a real child-process deadline", () => {
  const moduleUrl = new URL("./check-guidance.mjs", import.meta.url).href;
  const script = `const { markdownLinks } = await import(${JSON.stringify(moduleUrl)});
const malformed = "](".repeat(1_000_000);
if (markdownLinks(malformed).length !== 0) process.exitCode = 1;`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    },
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});

test("guidance recognizes genuine canonical full execution without duplicating each check in CI", () => {
  assert.deepEqual(inspect(fixture()), []);
});

test("guidance rejects omitted, repeated, unknown or advisory full entries", () => {
  for (const full of [[], ["types", "types"], ["ghost"], ["types", "lab"]]) {
    const state = fixture();
    state.manifest.profiles.full = full;
    assert.ok(inspect(state).length > 0, JSON.stringify(full));
  }
});

test("guidance rejects stale settings projections and discovery pointers", () => {
  const state = fixture();
  state.settings.recommendedChecks = ["npm run stale"];
  state.settings.recommendedChecksSource.profile = "focused";
  for (const name of ["navigation", "validation", "evaluation"])
    state.settings[name] = "missing.json";
  const errors = inspect(state).join("\n");
  for (const message of [
    "project",
    "canonical validation",
    "Settings navigation",
    "Settings validation",
    "Settings evaluation",
  ])
    assert.ok(errors.includes(message), message);
});

test("guidance rejects duplicate IDs, invalid definitions and false CI ownership", () => {
  for (const change of [
    (state) => state.manifest.checks.push(state.manifest.checks[0]),
    (state) => {
      state.manifest.checks[0].kind = "unknown";
    },
    (state) => {
      state.manifest.checks[0].ciJobs = [];
    },
    (state) => {
      state.manifest.checks[1].ciJobs = ["check"];
    },
    (state) => {
      state.manifest.profiles.guidance = ["missing"];
    },
  ]) {
    const state = fixture();
    change(state);
    assert.ok(inspect(state).length > 0);
  }
  assert.deepEqual(validateManifest({}, {}, {}), [
    "Invalid validation manifest schema",
  ]);
});

test("guidance delegates blocking canonical execution to both trusted workflow validators", () => {
  for (const owner of ["ci", "sonar"]) {
    for (const mode of ["omitted", "conditional", "advisory", "repeated"]) {
      const state = fixture();
      const job = Object.values(state[owner].jobs)[0];
      const full = job.steps.find(
        (step) => step.run === "npm run validate -- full",
      );
      if (mode === "omitted")
        job.steps = job.steps.filter((step) => step !== full);
      if (mode === "conditional") full.if = "always()";
      if (mode === "advisory") full["continue-on-error"] = true;
      if (mode === "repeated") job.steps.push({ ...full });
      assert.ok(
        inspect(state).some((error) => error.includes("execution policy")),
        owner + mode,
      );
    }
  }
});

const taskFixture = () => ({
  navigation: {
    schemaVersion: 1,
    tasks: [
      {
        id: "account",
        when: "Change profile",
        owners: ["owner.ts"],
        contracts: [],
        tests: ["test.ts"],
        checks: ["types"],
      },
    ],
  },
  evaluation: {
    schemaVersion: 1,
    cases: [
      {
        id: "profile",
        prompt: { en: "Explain" },
        taskIds: ["account"],
        evidence: ["owner.ts"],
        mustExplain: ["HTTP ownership"],
        mustNot: ["Import persistence"],
        checks: ["types"],
      },
    ],
  },
});
test("navigation and evaluation require real source paths, English prompts and registered checks", () => {
  const { navigation, evaluation } = taskFixture();
  const exists = (filename) => ["owner.ts", "test.ts"].includes(filename);
  assert.deepEqual(
    validateNavigation(navigation, evaluation, new Set(["types"]), exists),
    [],
  );
  navigation.tasks[0].owners = ["missing.ts"];
  evaluation.cases[0].prompt.fa = "";
  evaluation.cases[0].taskIds = ["unknown"];
  evaluation.cases[0].checks = ["missing-check"];
  const errors = validateNavigation(
    navigation,
    evaluation,
    new Set(["types"]),
    exists,
  ).join("\n");
  for (const message of [
    "missing.ts",
    "English-only",
    "task reference",
    "missing-check",
  ])
    assert.ok(errors.includes(message), message);
});

test("navigation rejects malformed schemas, duplicate tasks and empty source criteria", () => {
  const { navigation, evaluation } = taskFixture();
  navigation.tasks.push({
    ...navigation.tasks[0],
    when: "",
    owners: [],
    contracts: null,
    checks: null,
  });
  evaluation.cases.push({
    ...evaluation.cases[0],
    evidence: [],
    mustExplain: [],
    mustNot: [],
  });
  const errors = validateNavigation(
    navigation,
    evaluation,
    new Set(["types"]),
    () => true,
  ).join("\n");
  for (const message of [
    "unique",
    "task trigger",
    "no owner",
    "Invalid paths",
    "Invalid checks",
    "source evidence",
    "positive/negative",
  ])
    assert.ok(errors.includes(message), message);
  assert.deepEqual(
    validateNavigation({}, evaluation, new Set(), () => true),
    ["Invalid navigation schema"],
  );
  assert.deepEqual(
    validateNavigation(navigation, {}, new Set(), () => true),
    ["Invalid evaluation schema"],
  );
});

const createFixture = async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "kernel-guidance-test-"));
  context.after(async () => {
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("kernel-guidance-test-"));
    await rm(root, { recursive: true, force: true });
  });
  const write = async (filename, content) => {
    const target = path.join(root, filename);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  };
  const json = (filename, value) => write(filename, JSON.stringify(value));
  const state = fixture(),
    { navigation, evaluation } = taskFixture();
  await Promise.all([
    json(".agents/validation.json", state.manifest),
    json(".agents/settings.json", state.settings),
    json(".agents/navigation.json", navigation),
    json(".agents/evaluation/cases.json", evaluation),
    json("package.json", {
      name: "guidance-fixture",
      scripts: { typecheck: "tsc", lighthouse: "node lab.mjs" },
    }),
    json("package-lock.json", {
      name: "guidance-fixture",
      packages: { "": {} },
    }),
    write(".github/workflows/ci.yml", stringify(state.ci)),
    write(".github/workflows/sonar.yml", stringify(state.sonar)),
    write("AGENTS.md", "# Guide\n"),
    write("owner.ts", "// synthetic\n"),
    write("test.ts", "// synthetic\n"),
  ]);
  for (const name of [
    "source-navigation",
    "validation",
    "comprehension-evaluation",
  ])
    for (const suffix of [".md", ".fa.md"])
      await write("docs/" + name + suffix, "# Guide\n");
  return { root, write, json, state, navigation, evaluation };
};

test("current guidance paths, instruction entrypoints and canonical matrix agree", async () => {
  const result = await checkGuidance();
  assert.ok(result.tasks > 0);
  assert.ok(result.cases > 0);
  assert.deepEqual(result.errors, []);
});

test("host adapters are optional but existing links and English-only instruction files are checked", async (context) => {
  const { root, write } = await createFixture(context);
  assert.deepEqual((await checkGuidance(root)).errors, []);
  const adapter = ".claude/skills/design/SKILL.md";
  await write(adapter, "[Local guide](../../../AGENTS.md)\n");
  assert.deepEqual((await checkGuidance(root)).errors, []);
  for (const link of [
    "../../../missing.md",
    "../../../../outside.md",
    "../../../.env.local",
    "../../../bad%ZZ.md",
  ]) {
    await write(adapter, `[Invalid guide](${link})\n`);
    assert.ok(
      (await checkGuidance(root)).errors.some((error) =>
        error.includes("guide link"),
      ),
      link,
    );
  }
  await write(adapter, "[Local guide](../../../AGENTS.md)\n");
  for (const translated of [
    ".agents/rules/example.fa.md",
    ".claude/skills/design/SKILL.fa.md",
    "AGENTS.fa.md",
  ]) {
    await write(translated, "# Guide\n");
    assert.ok(
      (await checkGuidance(root)).errors.some((error) =>
        error.includes("English only"),
      ),
    );
    await rm(path.join(root, translated));
  }
});

test("missing indexed paths, scripts and obsolete package containers fail validation", async (context) => {
  const { root, json, state } = await createFixture(context);
  state.settings.rules = [".agents/missing.md", ".env.local"];
  await json(".agents/settings.json", state.settings);
  await json("package.json", { name: "guidance-fixture", scripts: {} });
  await mkdir(path.join(root, "apps"));
  const errors = (await checkGuidance(root)).errors.join("\n");
  for (const message of [
    "missing/unsafe",
    "no package script",
    "Obsolete project container",
  ])
    assert.ok(errors.includes(message), message);
});

test("symbolic documentation directories are rejected without reading target prose", async (context) => {
  const { root, write, json, navigation } = await createFixture(context);
  await write("server/data/never-read.md", "[sentinel](unread-target.md)\n");
  await symlink(
    path.join(root, "server/data"),
    path.join(root, "docs/alias"),
    "junction",
  );
  navigation.tasks[0].owners = ["docs/alias/never-read.md"];
  await json(".agents/navigation.json", navigation);
  const errors = (await checkGuidance(root)).errors.join("\n");
  assert.match(errors, /Symbolic guidance path/);
  assert.match(errors, /missing\/unsafe/);
  assert.ok(!errors.includes("unread-target.md"));
});

test("symbolic essential configuration is rejected before parsing outside JSON", async (context) => {
  const { root, write } = await createFixture(context);
  const outside = await mkdtemp(path.join(tmpdir(), "kernel-guidance-test-"));
  context.after(async () => {
    assert.equal(path.dirname(outside), path.resolve(tmpdir()));
    assert.ok(path.basename(outside).startsWith("kernel-guidance-test-"));
    await rm(outside, { recursive: true, force: true });
  });
  for (const name of [
    "validation.json",
    "settings.json",
    "navigation.json",
    "evaluation/cases.json",
  ]) {
    await mkdir(path.dirname(path.join(outside, name)), { recursive: true });
    await writeFile(path.join(outside, name), "UNREAD_OUTSIDE_JSON");
  }
  await rename(path.join(root, ".agents"), path.join(root, "original-agents"));
  await symlink(outside, path.join(root, ".agents"), "junction");
  await assert.rejects(checkGuidance(root), /escapes safe source/);
  assert.equal(
    await readFile(path.join(outside, "validation.json"), "utf8"),
    "UNREAD_OUTSIDE_JSON",
  );
  await write("README.md", "# Synthetic fixture\n");
});

test("guidance indexes reject traversal, private state, credentials and generated dependencies", () => {
  for (const value of [
    "../kernel/AGENTS.md",
    "C:/private/key",
    ".env.local",
    "src/.env.production",
    "server/data/test.sqlite",
    "node_modules/pkg/index.js",
    ".git/config",
    ".next/server.js",
    "coverage/report.md",
    "dist/index.md",
    "reports/run.md",
    ".agents/settings.local.json",
    "private.pem",
    "private.key",
  ])
    assert.equal(isSafeGuidancePath(value), false, value);
  for (const value of [
    "src/index.ts",
    "src/contracts/index.ts",
    "deploy/docker/.env.example",
    "deploy/native/api.env.example",
  ])
    assert.equal(isSafeGuidancePath(value), true, value);
});

test("standalone manifest and lockfile reject local links, workspaces and dependency drift", () => {
  assert.deepEqual(
    validateStandaloneManifest({
      name: "project",
      scripts: { build: "tsc" },
      dependencies: { axios: "1.20.0" },
    }),
    [],
  );
  const errors = validateStandaloneManifest({
    workspaces: [],
    dependencies: { "@kernel/contracts": "*", outside: "file:../kernel" },
    devDependencies: { local: "workspace:*", linked: "link:../shared" },
    scripts: { test: "npm run test --workspace=other" },
  });
  assert.equal(errors.length, 6);
  const pkg = { name: "project", dependencies: { axios: "1.20.0" } },
    lock = {
      name: "project",
      packages: { "": { dependencies: pkg.dependencies } },
    };
  assert.deepEqual(validateStandaloneLockfile(lock, pkg), []);
  lock.packages[""].dependencies = { axios: "0.0.0" };
  lock.packages["apps/old"] = {};
  lock.packages["node_modules/local"] = { link: true };
  assert.equal(validateStandaloneLockfile(lock, pkg).length, 3);
  assert.ok(
    validateStandaloneLockfile({}, pkg).some((error) =>
      error.includes("root project"),
    ),
  );
});
