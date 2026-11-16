import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  fixture,
  optionalBash,
  runOptionalHook,
} from "./hooks.test-support.mjs";

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
