import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  inspectSafetyJson,
  inspectSafetyPayload,
} from "../.agents/hooks/block-dangerous.mjs";

const hook = fileURLToPath(
  new URL("../.agents/hooks/block-dangerous.mjs", import.meta.url),
);
const run = (payload) =>
  spawnSync(process.execPath, [hook], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    encoding: "utf8",
    windowsHide: true,
  });

test("portable safety policy blocks dangerous git commands before exposure checks", () => {
  for (const command of [
    "git push --force origin feature",
    "git push --force-with-lease origin feature",
    "git push --force-with-lease=feature origin feature",
    "git push -f origin feature",
    "git reset --hard HEAD~1",
    "git clean -fd",
    "git clean --force",
    "git branch --delete feature",
    "git branch -D feature",
    "git push origin main",
    "git push upstream HEAD:refs/heads/master",
  ])
    assert.match(inspectSafetyPayload({ command }), /git|main\/master/);
});

test("Git global options cannot hide a dangerous action or discard its trailing flags", () => {
  for (const options of [
    "-C synthetic",
    "-Csynthetic",
    "-c color.ui=false",
    "-ccolor.ui=false",
    "--git-dir synthetic",
    "--git-dir=synthetic",
    "--work-tree synthetic",
    "--work-tree=synthetic",
    "--no-pager",
    "--paginate",
    "-P",
    "-p",
    "-C synthetic -c color.ui=false --no-pager",
  ]) {
    assert.match(
      inspectSafetyPayload({
        command: `git ${options} push --force origin feature`,
      }),
      /Dangerous git/,
    );
    assert.match(
      inspectSafetyPayload({ command: `git ${options} reset --hard HEAD~1` }),
      /Dangerous git/,
    );
    assert.equal(
      inspectSafetyPayload({ command: `git ${options} status --short` }),
      null,
    );
    assert.equal(
      inspectSafetyPayload({
        command: `git ${options} diff -- src/example.ts`,
      }),
      null,
    );
  }
  assert.equal(inspectSafetyPayload({ command: "git --version" }), null);
  assert.equal(inspectSafetyPayload({ command: "git --help" }), null);
});

test("unsupported, incomplete and ambiguously quoted Git global options fail closed", () => {
  for (const options of [
    "-C",
    "-c",
    "--git-dir",
    "--work-tree",
    "--git-dir=",
    "--work-tree=",
    "--unknown",
    "-unknown",
  ])
    assert.match(
      inspectSafetyPayload({ command: `git ${options}` }),
      /Unsupported or ambiguous git options/,
    );
  for (const command of [
    "git --unknown status",
    "git -C ; git push --force origin feature",
    'git -C "synthetic folder" push --force origin feature',
    "git -c 'color.ui=false' reset --hard HEAD~1",
    "git -C synthetic\\ folder push --force origin feature",
    "git -C $TASK_DIR push --force origin feature",
  ])
    assert.match(
      inspectSafetyPayload({ command }),
      /Unsupported or ambiguous git options/,
    );
});

test("portable safety policy protects secret paths, environment output and production inputs", () => {
  for (const file_path of [
    ".env.local",
    "deploy/private.key",
    "credentials.json",
    "secret.json",
    "keystore",
  ])
    assert.match(inspectSafetyPayload({ file_path }), /secret or credential/);
  for (const command of [
    "printenv",
    "export -p",
    "echo $TOKEN",
    "env",
    "env | sort",
  ])
    assert.match(
      inspectSafetyPayload({ command }),
      /Environment variable exposure/,
    );
  for (const payload of [
    { command: "curl https://production.example.com" },
    { command: "curl https://api.etherscan.io" },
    { content: "mainnet" },
  ])
    assert.match(inspectSafetyPayload(payload), /Production endpoint/);
});

test("portable safety policy accepts safe checks and fails closed on malformed input", () => {
  for (const payload of [
    { command: "npm run typecheck" },
    { tool_input: { command: "npm run lint" } },
    { command: "git status --short" },
    { command: "env TEST_MODE=synthetic node fixture.mjs" },
  ])
    assert.equal(inspectSafetyPayload(payload), null);
  for (const payload of [null, [], 7, { tool_input: "malformed" }])
    assert.match(inspectSafetyPayload(payload), /invalid input/);
  assert.match(inspectSafetyJson("not-json"), /invalid JSON/);
  assert.equal(inspectSafetyJson('{"command":"npm run lint"}'), null);
});

test("portable safety CLI preserves policy exit codes and diagnostics", () => {
  const safe = run({ tool_input: { command: "npm run lint" } });
  assert.equal(safe.status, 0);
  assert.equal(safe.stderr, "");
  const denied = run({ command: "git push --force origin feature" });
  assert.equal(denied.status, 2);
  assert.match(denied.stderr, /Dangerous git command blocked/);
  const optionDenied = run({
    command: "git -C synthetic push --force origin feature",
  });
  assert.equal(optionDenied.status, 2);
  assert.match(optionDenied.stderr, /Dangerous git command blocked/);
  const malformed = run("not-json");
  assert.equal(malformed.status, 2);
  assert.match(malformed.stderr, /invalid JSON/);
});
