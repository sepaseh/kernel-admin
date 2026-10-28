import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, URL } from "node:url";

const bashCandidates =
  process.platform === "win32"
    ? ["C:/Program Files/Git/bin/bash.exe", "bash"]
    : ["bash"];
const bash = bashCandidates.find((candidate) => {
  const result = spawnSync(
    candidate,
    ["--noprofile", "--norc", "-c", "printf '%s' kernel-hook-ready"],
    {
      encoding: "utf8",
      env: { ...process.env, BASH_ENV: "", ENV: "" },
      timeout: 5_000,
      windowsHide: true,
    },
  );
  return result.status === 0 && result.stdout === "kernel-hook-ready";
});
const hook = fileURLToPath(
  new URL("../.agents/hooks/block-dangerous.sh", import.meta.url),
);
const launchHook = `script=$1
runtime=$2
if command -v wslpath >/dev/null 2>&1; then
  script=$(wslpath -u "$script") || exit 2
  runtime=$(wslpath -u "$runtime") || exit 2
elif command -v cygpath >/dev/null 2>&1; then
  script=$(cygpath -u "$script") || exit 2
  runtime=$(cygpath -u "$runtime") || exit 2
fi
if [ "$3" = missing-node ]; then
  PATH=''
else
  PATH="$runtime:$PATH"
fi
export PATH
exec "$BASH" "$script"`;
const runHook = (payload, mode = "normal") =>
  spawnSync(
    bash,
    [
      "--noprofile",
      "--norc",
      "-c",
      launchHook,
      "kernel-hook-test",
      hook.replaceAll("\\", "/"),
      path.dirname(process.execPath).replaceAll("\\", "/"),
      mode,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, BASH_ENV: "", ENV: "" },
      input: typeof payload === "string" ? payload : JSON.stringify(payload),
      timeout: 5_000,
      windowsHide: true,
    },
  );

const optionalBash = {
  skip: !bash && "A usable Bash executable is unavailable",
};
for (const [name, payload] of [
  ["force push", { command: "git push --force origin feature" }],
  [
    "force with lease",
    { command: "git push --force-with-lease origin feature" },
  ],
  ["hard reset", { command: "git reset --hard HEAD~1" }],
  [
    "force push after a working-directory option",
    { command: "git -C synthetic push --force origin feature" },
  ],
  [
    "hard reset after a configuration option",
    { command: "git -c color.ui=false reset --hard HEAD~1" },
  ],
  ["direct main push", { command: "git push origin main" }],
  ["secret edit", { file_path: ".env.production" }],
  ["environment dump", { command: "printenv" }],
  ["production endpoint", { command: "curl http://production.example.com" }],
])
  test(`Bash safety wrapper blocks ${name}`, optionalBash, () => {
    assert.equal(runHook(payload).status, 2);
  });

test(
  "Bash safety wrapper allows safe commands through the Node guard",
  optionalBash,
  () => {
    assert.equal(runHook({ command: "npm run lint" }).status, 0);
    assert.equal(
      runHook({ tool_input: { command: "npm run typecheck" } }).status,
      0,
    );
    assert.equal(
      runHook({ command: "git --no-pager -C synthetic status --short" }).status,
      0,
    );
  },
);

test(
  "Bash safety wrapper fails closed for malformed JSON",
  optionalBash,
  () => {
    assert.equal(runHook("not-json").status, 2);
  },
);

test(
  "Bash safety wrapper fails closed when Node is unavailable",
  optionalBash,
  () => {
    const result = runHook({ command: "npm run lint" }, "missing-node");
    assert.equal(result.status, 2);
    assert.match(result.stderr, /requires Node.js/);
  },
);

const fixture = async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "kernel-optional-hook-test-"));
  context.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.match(path.basename(root), /^kernel-optional-hook-test-/);
    await rm(root, { force: true, recursive: true });
  });
  await writeFile(path.join(root, ".npmrc"), "");
  await writeFile(path.join(root, ".global-npmrc"), "");
  await writeFile(path.join(root, ".gitconfig"), "");
  return root;
};
const fixtureEnvironment = (root) => ({
  ...process.env,
  BASH_ENV: "",
  ENV: "",
  GIT_CONFIG_GLOBAL: path.join(root, ".gitconfig"),
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_COUNT: "0",
  NPM_CONFIG_USERCONFIG: path.join(root, ".npmrc"),
  NPM_CONFIG_GLOBALCONFIG: path.join(root, ".global-npmrc"),
});
const actualEslintCli = fileURLToPath(
  new URL("../node_modules/eslint/bin/eslint.js", import.meta.url),
);
const launchOptionalHook = `script=$1
runtime=$2
project=$3
eslint=$4
if command -v wslpath >/dev/null 2>&1; then
  script=$(wslpath -u "$script") || exit 2
  runtime=$(wslpath -u "$runtime") || exit 2
  project=$(wslpath -u "$project") || exit 2
  eslint=$(wslpath -u "$eslint") || exit 2
elif command -v cygpath >/dev/null 2>&1; then
  script=$(cygpath -u "$script") || exit 2
  runtime=$(cygpath -u "$runtime") || exit 2
  project=$(cygpath -u "$project") || exit 2
  eslint=$(cygpath -m "$eslint") || exit 2
fi
PATH="$runtime:$PATH"
AI_PROJECT_DIR="$project"
KERNEL_TEST_ESLINT_CLI="$eslint"
export PATH AI_PROJECT_DIR KERNEL_TEST_ESLINT_CLI
cd -- "$project" || exit 2
exec "$BASH" "$script"`;
const runOptionalHook = (root, filename, payload, environmentInput = false) =>
  spawnSync(
    bash,
    [
      "--noprofile",
      "--norc",
      "-c",
      launchOptionalHook,
      "kernel-optional-hook-test",
      fileURLToPath(new URL(`../.agents/hooks/${filename}`, import.meta.url)),
      path.dirname(process.execPath),
      root,
      actualEslintCli,
    ],
    {
      cwd: root,
      env: {
        ...fixtureEnvironment(root),
        INPUT: environmentInput ? payload : "",
      },
      encoding: "utf8",
      input: environmentInput ? undefined : payload,
      timeout: 15_000,
      windowsHide: true,
    },
  );
const formatterFixture = async (context) => {
  const root = await fixture(context);
  await mkdir(path.join(root, "node_modules/eslint/bin"), { recursive: true });
  await mkdir(path.join(root, "src"));
  await writeFile(
    path.join(root, "node_modules/eslint/bin/eslint.js"),
    `const { spawnSync } = require("node:child_process");
const result = spawnSync(process.execPath, [process.env.KERNEL_TEST_ESLINT_CLI, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
`,
  );
  await writeFile(
    path.join(root, "eslint.config.mjs"),
    'export default [{ files: ["**/*.ts"], rules: { "prefer-const": "error" } }];\n',
  );
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      private: true,
      scripts: { "lint:fix": "node node_modules/eslint/bin/eslint.js . --fix" },
    }),
  );
  const target = path.join(root, "src/edited file.ts");
  const unrelated = path.join(root, "src/unrelated.ts");
  await writeFile(target, "let edited = 1;\nconsole.log(edited);\n");
  await writeFile(unrelated, "let untouched = 2;\nconsole.log(untouched);\n");
  return { root, target, unrelated };
};

test(
  "post-edit formatter fixes only the selected file using local ESLint",
  optionalBash,
  async (context) => {
    for (const environmentInput of [false, true]) {
      const { root, target, unrelated } = await formatterFixture(context);
      const untouched = await readFile(unrelated, "utf8");
      const payload = environmentInput
        ? { file_path: "src/edited file.ts" }
        : { tool_input: { file_path: "src/edited file.ts" } };
      const result = runOptionalHook(
        root,
        "post-edit-format.sh",
        JSON.stringify(payload),
        environmentInput,
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        await readFile(target, "utf8"),
        "const edited = 1;\nconsole.log(edited);\n",
      );
      assert.equal(await readFile(unrelated, "utf8"), untouched);
    }
  },
);

test(
  "post-edit formatter ignores malformed JSON and non-string file paths",
  optionalBash,
  async (context) => {
    const { root, target, unrelated } = await formatterFixture(context);
    for (const payload of ["not-json", JSON.stringify({ file_path: 7 })]) {
      const result = runOptionalHook(root, "post-edit-format.sh", payload);
      assert.equal(result.status, 0, result.stderr);
      assert.match(await readFile(target, "utf8"), /^let edited/);
      assert.match(await readFile(unrelated, "utf8"), /^let untouched/);
    }
  },
);

test(
  "post-edit formatter treats an option-shaped file name as a file",
  optionalBash,
  async (context) => {
    const { root, unrelated } = await formatterFixture(context);
    const filename = "--fix-dry-run.ts";
    const target = path.join(root, filename);
    await writeFile(target, "let selected = 1;\nconsole.log(selected);\n");
    const untouched = await readFile(unrelated, "utf8");
    const result = runOptionalHook(
      root,
      "post-edit-format.sh",
      JSON.stringify({ file_path: filename }),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(target, "utf8"),
      "const selected = 1;\nconsole.log(selected);\n",
    );
    assert.equal(await readFile(unrelated, "utf8"), untouched);
  },
);

const fixtureGit = (root, args) => {
  const result = spawnSync(
    "git",
    ["-C", root, "-c", "core.hooksPath=.git/no-hooks", ...args],
    {
      env: fixtureEnvironment(root),
      encoding: "utf8",
      timeout: 5_000,
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, result.stderr);
};
const qualityFixture = async (context) => {
  const root = await fixture(context);
  await mkdir(path.join(root, "src"));
  await writeFile(
    path.join(root, "src/tracked.ts"),
    "export const value = 1;\n",
  );
  await writeFile(
    path.join(root, "checks.cjs"),
    `const fs = require("node:fs");
const name = process.argv[2];
fs.appendFileSync("checks.log", name + "\\n");
if (name === "typecheck" && fs.existsSync("fail-typecheck")) process.exit(1);
`,
  );
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      private: true,
      scripts: {
        lint: "node checks.cjs lint",
        typecheck: "node checks.cjs typecheck",
      },
    }),
  );
  fixtureGit(root, ["init", "--initial-branch=main"]);
  fixtureGit(root, [
    "add",
    "--",
    "src/tracked.ts",
    "checks.cjs",
    "package.json",
  ]);
  fixtureGit(root, [
    "-c",
    "user.name=Kernel Hook Test",
    "-c",
    "user.email=hook-test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "Synthetic hook fixture",
  ]);
  return root;
};
const checkedCommands = async (root) =>
  (await readFile(path.join(root, "checks.log"), "utf8")).trim().split("\n");

test(
  "quality hook runs for staged and unstaged TypeScript deletions",
  optionalBash,
  async (context) => {
    for (const staged of [false, true]) {
      const root = await qualityFixture(context);
      await rm(path.join(root, "src/tracked.ts"));
      if (staged) fixtureGit(root, ["add", "--", "src/tracked.ts"]);
      const result = runOptionalHook(root, "quality-gate.sh", "");
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(await checkedCommands(root), ["lint", "typecheck"]);
    }
  },
);

test(
  "quality hook propagates typecheck failure as exit 2",
  optionalBash,
  async (context) => {
    const root = await qualityFixture(context);
    await rm(path.join(root, "src/tracked.ts"));
    await writeFile(path.join(root, "fail-typecheck"), "synthetic failure\n");
    const result = runOptionalHook(root, "quality-gate.sh", "");
    assert.equal(result.status, 2, result.stderr);
    assert.deepEqual(await checkedCommands(root), ["lint", "typecheck"]);
  },
);

test(
  "quality hook runs for tracked and untracked TypeScript changes",
  optionalBash,
  async (context) => {
    for (const tracked of [false, true]) {
      const root = await qualityFixture(context);
      await writeFile(
        path.join(root, tracked ? "src/tracked.ts" : "src/new.ts"),
        "export const changed = true;\n",
      );
      const result = runOptionalHook(root, "quality-gate.sh", "");
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(await checkedCommands(root), ["lint", "typecheck"]);
    }
  },
);

test(
  "quality hook skips checks when no TypeScript files changed",
  optionalBash,
  async (context) => {
    const root = await qualityFixture(context);
    await writeFile(
      path.join(root, "notes.md"),
      "Synthetic non-source change\n",
    );
    const result = runOptionalHook(root, "quality-gate.sh", "");
    assert.equal(result.status, 0, result.stderr);
    await assert.rejects(readFile(path.join(root, "checks.log")), {
      code: "ENOENT",
    });
  },
);
