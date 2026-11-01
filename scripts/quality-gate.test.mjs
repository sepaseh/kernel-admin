import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  fixture,
  fixtureEnvironment,
  optionalBash,
  runOptionalHook,
} from "./hooks.test-support.mjs";

const fixtureGit = (root, args) => {
  const result = spawnSync(
    "git",
    ["-C", root, "-c", "core.hooksPath=.git/no-hooks", ...args],
    {
      env: fixtureEnvironment(root),
      encoding: "utf8",
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
if (name === "lint" && fs.existsSync("fail-lint")) process.exit(1);
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
  "quality hook stops before typecheck when lint fails",
  optionalBash,
  async (context) => {
    const root = await qualityFixture(context);
    await rm(path.join(root, "src/tracked.ts"));
    await writeFile(path.join(root, "fail-lint"), "synthetic failure\n");
    const result = runOptionalHook(root, "quality-gate.sh", "");
    assert.equal(result.status, 2, result.stderr);
    assert.deepEqual(await checkedCommands(root), ["lint"]);
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
