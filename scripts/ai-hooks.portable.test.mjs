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
    timeout: 5_000,
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
    "git -C $TASK_DIR push --force origin feature",
  ])
    assert.match(
      inspectSafetyPayload({ command }),
      /Unsupported or ambiguous git options/,
    );
});

test("literal quoted Git option values retain dangerous-action checks", () => {
  for (const command of [
    'git -C "synthetic folder" push --force origin feature',
    "git -c 'color.ui=false' reset --hard HEAD~1",
    "git -C synthetic\\ folder push --force origin feature",
  ])
    assert.match(inspectSafetyPayload({ command }), /Dangerous git/);
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

test("force clusters, forced refspecs and implicit push destinations are rejected", () => {
  for (const command of [
    "git push -uf origin feature",
    "git push -fu origin feature",
    "git push origin +HEAD:feature",
    "git push origin",
    "git push upstream",
    "git push",
    "git push --all origin",
  ])
    assert.notEqual(inspectSafetyPayload({ command }), null, command);

  for (const command of [
    "git push -u origin feature",
    "git push --dry-run origin HEAD:feature",
  ])
    assert.equal(inspectSafetyPayload({ command }), null, command);
});

test("Git arguments end at shell boundaries while later commands remain inspected", () => {
  for (const separator of ["&&", ";", "|", "\n"]) {
    assert.equal(
      inspectSafetyPayload({
        command: `git push origin feature ${separator} echo main`,
      }),
      null,
    );
    assert.notEqual(
      inspectSafetyPayload({
        command: `git push origin feature ${separator} git push --force origin feature`,
      }),
      null,
    );
  }
  assert.equal(
    inspectSafetyPayload({
      command: "git push origin feature && cat docs/main",
    }),
    null,
  );
  assert.equal(
    inspectSafetyPayload({
      command: "printf '%s' 'git push --force origin main'",
    }),
    null,
  );
});

test("literal nested shells and qualified Git executables retain safety checks", () => {
  for (const command of [
    "bash -c 'git push --force origin feature'",
    'sh -c "git push --force origin feature"',
    "bash -lc 'git push origin main'",
    "/usr/bin/git push --force origin feature",
    '"C:/Program Files/Git/cmd/git.exe" push -uf origin feature',
  ])
    assert.notEqual(inspectSafetyPayload({ command }), null, command);

  for (const command of [
    "bash -c 'git status --short'",
    "sh -c 'printf synthetic'",
    "/usr/bin/git status --short",
    "cd ~/src/git && make",
    "printf '%s' '/usr/bin/git push --force origin feature'",
    'git -C "synthetic folder" status --short',
  ])
    assert.equal(inspectSafetyPayload({ command }), null, command);
});

test("secret variable output and bare env redirection are rejected without exposing values", () => {
  for (const command of [
    "printf '%s\\n' \"$TOKEN\"",
    "printf '%s' \"${API_KEY}\"",
    "env > environment.txt",
    "env >environment.txt",
    "env>environment.txt",
    "env 1>environment.txt",
    "env >>environment.txt",
    ">environment.txt env",
  ])
    assert.match(
      inspectSafetyPayload({ command }),
      /Environment variable exposure/,
      command,
    );

  for (const command of [
    "printf '%s' synthetic",
    "printf '%s' '$TOKEN'",
    "echo '$TOKEN'",
    "env TEST_MODE=synthetic node fixture.mjs > fixture-output.txt",
  ])
    assert.equal(inspectSafetyPayload({ command }), null, command);
});

test("shell operands and redirection targets protect secret files with quote handling", () => {
  for (const command of [
    "sed -i 's/X=0/X=1/' .env",
    "sed -i 's/X=0/X=1/' .env.local",
    'cat ".env.local"',
    "printf synthetic >.env",
    "cat < .env",
  ])
    assert.match(
      inspectSafetyPayload({ command }),
      /secret or credential/,
      command,
    );

  for (const command of [
    "cat docs/example.md",
    "printf '%s' '.env is a protected filename'",
    "printf synthetic > fixture-output.txt",
  ])
    assert.equal(inspectSafetyPayload({ command }), null, command);
});

test("uncertain shell syntax and excessive literal shell nesting fail closed", () => {
  for (const command of [
    "git -C 'unfinished status",
    "git -C $TASK_DIR push --force origin feature",
    'bash -c "$SCRIPT"',
    "bash synthetic.sh",
    "$(synthetic-command)",
    "`synthetic-command`",
    "cat <<EOF",
    "$'git' push --force origin feature",
    '$"git" push --force origin feature',
    "command -p git push --force origin feature",
    "sudo -u synthetic git push --force origin feature",
    "env env env env env env git status",
    "x".repeat(65_537),
  ])
    assert.notEqual(inspectSafetyPayload({ command }), null, command);

  let command = "git status";
  for (let index = 0; index < 6; index++)
    command = "bash -c " + JSON.stringify(command);
  assert.notEqual(inspectSafetyPayload({ command }), null);
});

test("non-IFS whitespace cannot stall literal command scanning", () => {
  for (const whitespace of ["\f", "\v", "\u00a0", "\u2003"]) {
    const result = run({ command: "synthetic" + whitespace + "argument" });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr);
  }
});

test("extensionless credential paths are protected without reading any files", () => {
  for (const file_path of [
    "~/.aws/credentials",
    "fixtures/credentials",
    "C:\\Users\\synthetic\\.aws\\credentials",
  ])
    assert.match(inspectSafetyPayload({ file_path }), /secret or credential/);

  for (const command of [
    "cat ~/.aws/credentials",
    "cat < fixtures/credentials",
    "printf synthetic > fixtures/credentials",
  ])
    assert.match(inspectSafetyPayload({ command }), /secret or credential/);

  for (const file_path of [
    "docs/credentials-guide.md",
    "fixtures/credentials-example",
  ])
    assert.equal(inspectSafetyPayload({ file_path }), null);
});

test("pushes require an explicit destination for HEAD and matching refspecs", () => {
  for (const command of [
    "git push origin HEAD",
    "git push -u origin HEAD",
    "git push origin :",
    "git push --porcelain origin feature :",
  ])
    assert.notEqual(inspectSafetyPayload({ command }), null, command);

  for (const command of [
    "git push origin HEAD:feature",
    "git push origin HEAD:refs/heads/feature",
    "git push origin refs/heads/feature",
    "git push origin feature",
  ])
    assert.equal(inspectSafetyPayload({ command }), null, command);
});

test("branch deletion flags include lowercase and real short-option clusters", () => {
  for (const options of ["-d", "-vd", "-dv", "-rd", "-rD", "-vvD"])
    assert.match(
      inspectSafetyPayload({ command: `git branch ${options} feature` }),
      /Dangerous git/,
      options,
    );

  for (const options of ["--list", "-r", "-v", "-a", "feature-d"])
    assert.equal(
      inspectSafetyPayload({ command: `git branch ${options}` }),
      null,
      options,
    );
});

test("inline Git aliases fail closed before an alias can hide its action", () => {
  for (const command of [
    "git -c 'alias.ship=!git push --force origin feature' ship",
    "git -calias.ship='!git push --force origin feature' ship",
    "git -c alias.ship=push ship origin main",
    "git -c Alias.ship=status ship",
    "git -c color.ui=false -calias.ship=push ship origin main",
  ])
    assert.match(
      inspectSafetyPayload({ command }),
      /ambiguous git options/,
      command,
    );

  for (const command of [
    "git -c color.ui=false status --short",
    "git -ccolor.ui=false diff -- src/example.ts",
  ])
    assert.equal(inspectSafetyPayload({ command }), null, command);
});

test("Git configuration assignments cannot disappear while finding the executable", () => {
  for (const command of [
    "GIT_CONFIG_COUNT=1 git status",
    "TEST_MODE=synthetic GIT_CONFIG_PARAMETERS=synthetic git status",
    "GIT_CONFIG=synthetic git status",
    "env GIT_CONFIG_GLOBAL=synthetic git push origin feature",
    "env GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.ship GIT_CONFIG_VALUE_0='!git push --force origin main' git ship",
  ])
    assert.match(
      inspectSafetyPayload({ command }),
      /ambiguous git options/,
      command,
    );

  for (const command of [
    "TEST_MODE=synthetic git status",
    "env TEST_MODE=synthetic node fixture.mjs",
    "printf '%s' 'GIT_CONFIG_COUNT=1'",
  ])
    assert.equal(inspectSafetyPayload({ command }), null, command);
});

test("access-key expansions are blocked while literal variable names stay printable", () => {
  for (const command of [
    'printf "%s" "$ACCESS_KEY"',
    'echo "${AWS_ACCESS_KEY_ID}"',
    'printf "%s" "${storage_access_key}"',
  ])
    assert.match(
      inspectSafetyPayload({ command }),
      /Environment variable exposure/,
    );

  for (const command of [
    "printf '%s' '$ACCESS_KEY'",
    "echo '${AWS_ACCESS_KEY_ID}'",
    'printf "%s" "$PUBLIC_LABEL"',
  ])
    assert.equal(inspectSafetyPayload({ command }), null, command);
});

test("dash literal command payloads use the same bounded checks as sh", () => {
  for (const command of [
    "dash -c 'git push --force origin feature'",
    '/bin/dash -c "git push origin main"',
    "dash.exe -c 'cat ~/.aws/credentials'",
    "sh -c \"dash -c 'git branch -d feature'\"",
  ])
    assert.notEqual(inspectSafetyPayload({ command }), null, command);

  for (const command of [
    "dash -c 'git status --short'",
    "/bin/dash -c 'printf synthetic'",
    "dash.exe -c 'git diff -- src/example.ts'",
  ])
    assert.equal(inspectSafetyPayload({ command }), null, command);
});

test("xargs command construction fails closed without modeling its input", () => {
  for (const command of [
    "xargs git push --force origin feature",
    "xargs.exe git push --force origin feature",
    "printf '%s' synthetic | xargs git push origin main",
    "xargs -I {} sh -c 'git branch -d {}'",
  ])
    assert.match(
      inspectSafetyPayload({ command }),
      /Unsupported or ambiguous shell/,
    );

  assert.equal(
    inspectSafetyPayload({
      command: "printf '%s' 'xargs git push origin main'",
    }),
    null,
  );
});

test("bare export and listing options are blocked while explicit declarations remain usable", () => {
  for (const command of [
    "export",
    "export > environment.txt",
    "export --",
    "export -n",
    "export -np",
    "export -pf TEST_MODE",
  ])
    assert.match(
      inspectSafetyPayload({ command }),
      /Environment variable exposure/,
    );

  for (const command of [
    "export TEST_MODE=synthetic",
    "export TEST_MODE",
    "export -n TEST_MODE",
    "export -- TEST_MODE=synthetic",
  ])
    assert.equal(inspectSafetyPayload({ command }), null, command);
});
