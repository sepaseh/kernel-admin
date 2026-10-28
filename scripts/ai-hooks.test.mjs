import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
