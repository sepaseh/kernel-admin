import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bashCandidates =
  process.platform === "win32"
    ? ["C:/Program Files/Git/bin/bash.exe", "bash"]
    : ["bash"];
export const bash = bashCandidates.find((candidate) => {
  const result = spawnSync(
    candidate,
    ["--noprofile", "--norc", "-c", "printf '%s' kernel-hook-ready"],
    {
      encoding: "utf8",
      env: { ...process.env, BASH_ENV: "", ENV: "" },
      windowsHide: true,
    },
  );
  return result.status === 0 && result.stdout === "kernel-hook-ready";
});
export const optionalBash = {
  skip: !bash && "A usable Bash executable is unavailable",
};
export const fixture = async (context) => {
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
export const fixtureEnvironment = (root) => ({
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
export const runOptionalHook = (
  root,
  filename,
  payload,
  environmentInput = false,
) =>
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
      windowsHide: true,
    },
  );
