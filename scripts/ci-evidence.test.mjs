import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  evidenceManifest,
  maximumCoverageBytes,
  readCoverage,
  runEvidence,
  sourceIdentity,
} from "./ci-evidence.mjs";

const commit = "a".repeat(40);
const tree = "b".repeat(40);
const workflow = "c".repeat(40);
const head = "d".repeat(40);
const base = "e".repeat(40);
const lcov = (source = "src/example.ts") =>
  `TN:\nSF:${source}\nDA:1,1\nLF:1\nLH:1\nend_of_record\n`;
const powershell =
  '<coverage version="1"><file path="scripts/stop-visual-process-tree.ps1"><lineToCover lineNumber="1" covered="true"/><lineToCover lineNumber="3" covered="false"/></file></coverage>\n';
const identityOptions = () => ({
  environment: {
    GITHUB_REPOSITORY: "example/api",
    GITHUB_EVENT_NAME: "pull_request",
    GITHUB_SHA: commit,
    GITHUB_RUN_ID: "123",
    GITHUB_RUN_ATTEMPT: "1",
    CI_EVIDENCE_PRODUCER_ATTEMPT: "1",
    CI_EVIDENCE_SUITE: "unit",
  },
  event: {
    repository: { full_name: "example/api" },
    pull_request: {
      head: { sha: head },
      base: { sha: base, repo: { full_name: "example/api" } },
    },
  },
  git: (args) => {
    const commands = {
      "rev-parse HEAD": commit,
      "rev-parse HEAD^{tree}": tree,
      "rev-parse HEAD:.github/workflows/ci.yml": workflow,
      "diff --name-only HEAD --": "",
    };
    assert.ok(Object.hasOwn(commands, args.join(" ")));
    return commands[args.join(" ")];
  },
});
const fixture = async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "kernel-ci-evidence-"));
  context.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("kernel-ci-evidence-"));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, "src"));
  await mkdir(path.join(root, "coverage/unit"), { recursive: true });
  await mkdir(path.join(root, "coverage/governance"), { recursive: true });
  await mkdir(path.join(root, "scripts"));
  await writeFile(
    path.join(root, "scripts/stop-visual-process-tree.ps1"),
    "# synthetic helper\nWrite-Output 'fixture'\n# uncovered\n",
  );
  await writeFile(
    path.join(root, "coverage/governance/powershell.xml"),
    powershell,
  );
  await writeFile(
    path.join(root, "src/example.ts"),
    "export const value = 1;\n",
  );
  await writeFile(path.join(root, "coverage/unit/lcov.info"), lcov());
  await writeFile(path.join(root, "coverage/governance/lcov.info"), lcov());
  const outputs = [];
  return {
    root,
    ...identityOptions(),
    output: (values) => outputs.push(values),
    outputs,
  };
};
const gitExecutable =
  process.platform === "win32"
    ? String.raw`C:\Program Files\Git\bin\git.exe`
    : "/usr/bin/git";
const emptyConfig = process.platform === "win32" ? "NUL" : "/dev/null";
const readManifest = async (root) =>
  JSON.parse(
    await readFile(path.join(root, "coverage/unit/ci-evidence.json"), "utf8"),
  );
const putManifest = (root, value) =>
  writeFile(
    path.join(root, "coverage/unit/ci-evidence.json"),
    JSON.stringify(value),
  );

const syntheticEnvironment = {
  KERNEL_SYNTHETIC_ENV: "1",
  VITE_API_BASE_URL: "https://api.example.com",
  VITE_APP_BASE_URL: "/",
  VITE_OBSERVABILITY_URL: "",
  VITE_RELEASE_ID: "application-verification",
};
const putBuildRecord = (root, record) =>
  writeFile(
    path.join(root, "coverage/verification-build.json"),
    JSON.stringify(record, null, 2) + "\n",
  );
const buildFixture = async (context) => {
  const options = await fixture(context);
  options.environment = { ...options.environment, ...syntheticEnvironment };
  delete options.environment.CI_EVIDENCE_SUITE;
  await mkdir(path.join(options.root, ".github"));
  await writeFile(
    path.join(options.root, ".github/bootstrap-policy.json"),
    JSON.stringify({ allowedFiles: ["src/example.ts"] }),
  );
  const sourceInputs = [".github/bootstrap-policy.json", "src/example.ts"];
  const hash = createHash("sha256");
  for (const file of sourceInputs) {
    const bytes = await readFile(path.join(options.root, file));
    hash
      .update(file)
      .update("\0")
      .update(String(bytes.length))
      .update("\0")
      .update(bytes);
  }
  const build = {
    schemaVersion: 1,
    apiOrigin: syntheticEnvironment.VITE_API_BASE_URL,
    basePath: "/",
    releaseId: "application-verification",
  };
  const output = {
    "_kernel/build.json": JSON.stringify(build),
    "assets/app.js": "console.info('synthetic application');\n",
    "assets/empty.css": "",
    "index.html": "<main>synthetic application</main>\n",
  };
  const distribution = [];
  for (const [relative, contents] of Object.entries(output)) {
    const filename = path.join(options.root, "dist", relative);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, contents);
    distribution.push({
      path: relative,
      bytes: Buffer.byteLength(contents),
      sha256: createHash("sha256").update(contents).digest("hex"),
    });
  }
  const record = {
    schemaVersion: 1,
    environment: syntheticEnvironment,
    sourceFingerprint: hash.digest("hex"),
    sourceInputs,
    distribution,
    build,
  };
  await putBuildRecord(options.root, record);
  return { ...options, record };
};

test("governance preserves genuinely measured PowerShell bytes and emits the scanner report path", async (context) => {
  const options = await fixture(context);
  options.environment.CI_EVIDENCE_SUITE = "governance";
  await runEvidence("--record", options);
  const report = JSON.parse(
    await readFile(
      path.join(options.root, "coverage/governance/ci-evidence.json"),
    ),
  );
  assert.equal(report.coverage.length, 2);
  assert.deepEqual(report.coverage[1], {
    path: "coverage/governance/powershell.xml",
    bytes: Buffer.byteLength(powershell),
    sha256: createHash("sha256").update(powershell).digest("hex"),
  });
  await runEvidence("--verify-coverage", options);
  assert.deepEqual(options.outputs.at(-1), {
    powershell_report: "coverage/governance/powershell.xml",
  });
  await writeFile(
    path.join(options.root, "coverage/governance/powershell.xml"),
    powershell.replace('covered="false"', 'covered="true"'),
  );
  await assert.rejects(
    runEvidence("--verify-coverage", options),
    /does not match/,
  );
});

test("Windows governance requires PowerShell measurement while other hosts explicitly report its absence", async (context) => {
  const options = await fixture(context);
  options.environment.CI_EVIDENCE_SUITE = "governance";
  await rm(path.join(options.root, "coverage/governance/powershell.xml"));
  await assert.rejects(
    runEvidence("--record", { ...options, platform: "win32" }),
    { code: "ENOENT" },
  );
  await runEvidence("--record", { ...options, platform: "linux" });
  await runEvidence("--verify-coverage", { ...options, platform: "linux" });
  assert.deepEqual(options.outputs.at(-1), { powershell_report: "" });
  await assert.rejects(
    runEvidence("--verify-coverage", { ...options, platform: "win32" }),
    { code: "ENOENT" },
  );
});

test("PowerShell evidence rejects malformed, unmeasured, duplicated and out-of-source line records", async (context) => {
  const options = await fixture(context);
  options.environment.CI_EVIDENCE_SUITE = "governance";
  for (const value of [
    "",
    "not coverage",
    powershell.replaceAll('covered="true"', 'covered="false"'),
    powershell.replace('lineNumber="3"', 'lineNumber="1"'),
    powershell.replace('lineNumber="3"', 'lineNumber="100"'),
    powershell.replace('lineNumber="3"', 'lineNumber="9007199254740993"'),
    powershell.replace(
      "scripts/stop-visual-process-tree.ps1",
      "../private.ps1",
    ),
    powershell.replace("</file>", "<unexpected/></file>"),
    Buffer.from([255]),
  ]) {
    await writeFile(
      path.join(options.root, "coverage/governance/powershell.xml"),
      value,
    );
    await assert.rejects(runEvidence("--record", options));
  }
});

test("build transport binds the owner's existing record and every output byte without rebuilding", async (context) => {
  const options = await buildFixture(context);
  const original = await readFile(
    path.join(options.root, "coverage/verification-build.json"),
  );
  await runEvidence("--record-build", options);
  assert.deepEqual(options.outputs, [
    { artifact: "verification-build-123-1", attempt: "1" },
  ]);
  assert.deepEqual(
    await readFile(path.join(options.root, "coverage/verification-build.json")),
    original,
  );
  const manifest = JSON.parse(
    await readFile(path.join(options.root, "coverage/ci-build-evidence.json")),
  );
  assert.deepEqual(
    manifest.files.map((file) => file.path),
    [
      "coverage/verification-build.json",
      "dist/_kernel/build.json",
      "dist/assets/app.js",
      "dist/assets/empty.css",
      "dist/index.html",
    ],
  );
  const consumer = await buildFixture(context);
  await rm(path.join(consumer.root, "dist"), { recursive: true });
  await cp(path.join(options.root, "dist"), path.join(consumer.root, "dist"), {
    recursive: true,
  });
  await copyFile(
    path.join(options.root, "coverage/verification-build.json"),
    path.join(consumer.root, "coverage/verification-build.json"),
  );
  await copyFile(
    path.join(options.root, "coverage/ci-build-evidence.json"),
    path.join(consumer.root, "coverage/ci-build-evidence.json"),
  );
  consumer.environment.GITHUB_RUN_ATTEMPT = "3";
  await runEvidence("--verify-build", consumer);
  assert.deepEqual(consumer.outputs, []);
});

test("build verification rejects foreign producers, runs, source heads, bases, trees and workflows", async (context) => {
  const options = await buildFixture(context);
  await runEvidence("--record-build", options);
  for (const change of [
    (value) => {
      value.environment.GITHUB_RUN_ID = "124";
    },
    (value) => {
      value.environment.GITHUB_RUN_ATTEMPT = "3";
      value.environment.CI_EVIDENCE_PRODUCER_ATTEMPT = "2";
    },
    (value) => {
      value.event.pull_request.head.sha = "f".repeat(40);
    },
    (value) => {
      value.event.pull_request.base.sha = "f".repeat(40);
    },
    (value) => {
      value.git = (args) =>
        args[1] === "HEAD^{tree}" ? "f".repeat(40) : options.git(args);
    },
    (value) => {
      value.git = (args) =>
        args[1] === "HEAD:.github/workflows/ci.yml"
          ? "f".repeat(40)
          : options.git(args);
    },
  ]) {
    const changed = {
      ...options,
      environment: { ...options.environment },
      event: structuredClone(options.event),
    };
    change(changed);
    await assert.rejects(
      runEvidence("--verify-build", changed),
      /does not match/,
    );
  }
  for (const attempt of [undefined, "0", "2"]) {
    await assert.rejects(
      runEvidence("--verify-build", {
        ...options,
        environment: {
          ...options.environment,
          CI_EVIDENCE_PRODUCER_ATTEMPT: attempt,
        },
      }),
      /producer attempt|exact clean checkout/,
    );
  }
});

test("build evidence rejects missing, added or changed outputs and altered owner records", async (context) => {
  const options = await buildFixture(context);
  await runEvidence("--record-build", options);
  const target = path.join(options.root, "dist/assets/app.js");
  const original = await readFile(target);
  await writeFile(target, "changed bytes");
  await assert.rejects(runEvidence("--verify-build", options), /distribution/);
  await writeFile(target, original);
  const added = path.join(options.root, "dist/assets/foreign.js");
  await writeFile(added, "additional bytes");
  await assert.rejects(runEvidence("--verify-build", options), /distribution/);
  await rm(added);
  await rm(target);
  await assert.rejects(runEvidence("--verify-build", options), /distribution/);
  await writeFile(target, original);
  await writeFile(
    path.join(options.root, "coverage/verification-build.json"),
    JSON.stringify(options.record),
  );
  await assert.rejects(
    runEvidence("--verify-build", options),
    /does not match/,
  );
  await putBuildRecord(options.root, options.record);
  await writeFile(
    path.join(options.root, "src/example.ts"),
    "changed source\n",
  );
  await assert.rejects(
    runEvidence("--verify-build", options),
    /source fingerprint/,
  );
});

test("build recording requires matching inventory, synthetic environment, metadata and ordinary artifact paths", async (context) => {
  const options = await buildFixture(context);
  for (const change of [
    (record) => {
      record.schemaVersion = 2;
    },
    (record) => {
      record.environment.VITE_API_BASE_URL = "https://foreign.invalid";
    },
    (record) => {
      record.sourceInputs.push("../private");
    },
    (record) => {
      record.build.releaseId = "foreign";
    },
  ]) {
    const changed = structuredClone(options.record);
    change(changed);
    await putBuildRecord(options.root, changed);
    await assert.rejects(runEvidence("--record-build", options));
  }
  await putBuildRecord(options.root, options.record);
  await assert.rejects(
    runEvidence("--record-build", {
      ...options,
      environment: { ...options.environment, VITE_RELEASE_ID: "foreign" },
    }),
    /synthetic environment/,
  );
  const manifest = path.join(options.root, "coverage/ci-build-evidence.json");
  await mkdir(manifest);
  await assert.rejects(
    runEvidence("--record-build", options),
    /must not contain links/,
  );
  await rm(manifest, { recursive: true });
  await rm(path.join(options.root, "dist/assets"), { recursive: true });
  await mkdir(path.join(options.root, "linked-assets"));
  await symlink(
    path.join(options.root, "linked-assets"),
    path.join(options.root, "dist/assets"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(
    runEvidence("--record-build", options),
    /must not contain links/,
  );
});

test("records measured bytes and verifies the exact same-run source identity", async (context) => {
  const options = await fixture(context);
  const identity = await runEvidence("--record", options);
  assert.deepEqual(identity, {
    repository: "example/api",
    head,
    base,
    commit,
    tree,
    workflow,
    runId: "123",
    attempt: "1",
  });
  assert.deepEqual(options.outputs, [
    { artifact: "coverage-unit-123-1", attempt: "1" },
  ]);
  assert.deepEqual(
    await readManifest(options.root),
    evidenceManifest(
      identity,
      [{ reportPath: "coverage/unit/lcov.info", bytes: Buffer.from(lcov()) }],
      "unit",
    ),
  );
  await runEvidence("--verify-coverage", options);
  assert.equal(options.outputs.length, 1);
});

test("hashes report bytes without rewriting CRLF or Windows source separators", async (context) => {
  const options = await fixture(context);
  const report = Buffer.from(lcov("src\\example.ts").replaceAll("\n", "\r\n"));
  await writeFile(path.join(options.root, "coverage/unit/lcov.info"), report);
  await runEvidence("--record", options);
  const manifest = await readManifest(options.root);
  assert.equal(manifest.coverage[0].bytes, report.length);
  assert.equal(
    manifest.coverage[0].sha256,
    createHash("sha256").update(report).digest("hex"),
  );
  await runEvidence("--verify-coverage", options);
});

test("supports actual push, scheduled and manual dispatch payloads", () => {
  const options = identityOptions();
  options.environment.GITHUB_EVENT_NAME = "push";
  options.event = {
    repository: { full_name: "example/api" },
    before: base,
    after: commit,
  };
  assert.equal(sourceIdentity(options).base, base);
  assert.equal(sourceIdentity(options).head, commit);
  options.event.before = "0".repeat(40);
  assert.equal(sourceIdentity(options).base, null);
  for (const eventName of ["workflow_dispatch", "schedule"]) {
    options.environment.GITHUB_EVENT_NAME = eventName;
    options.event = { repository: { full_name: "example/api" } };
    assert.equal(sourceIdentity(options).base, null);
    assert.equal(sourceIdentity(options).head, commit);
  }
});

test("rejects missing or inconsistent trusted event and checkout identity", () => {
  const changes = [
    (o) => {
      o.environment.GITHUB_SHA = head;
    },
    (o) => {
      o.environment.GITHUB_REPOSITORY = "foreign/repo";
    },
    (o) => {
      o.environment.GITHUB_REPOSITORY = "../repo";
    },
    (o) => {
      o.event.pull_request.head.sha = "0".repeat(40);
    },
    (o) => {
      o.event.pull_request.base.sha = undefined;
    },
    (o) => {
      o.event.pull_request.base.repo.full_name = "foreign/repo";
    },
    (o) => {
      o.environment.GITHUB_RUN_ID = "123\nartifact=foreign";
    },
    (o) => {
      o.environment.GITHUB_RUN_ATTEMPT = "0";
    },
    (o) => {
      o.environment.GITHUB_EVENT_NAME = "pull_request_target";
    },
    (o) => {
      o.git = (args) =>
        args[0] === "diff" ? "src/changed.ts" : identityOptions().git(args);
    },
    (o) => {
      o.git = (args) =>
        args[1] === "HEAD:.github/workflows/ci.yml"
          ? "invalid"
          : identityOptions().git(args);
    },
    (o) => {
      o.environment.GITHUB_EVENT_NAME = "push";
      o.event.before = base;
      o.event.after = head;
    },
  ];
  for (const change of changes) {
    const options = identityOptions();
    change(options);
    assert.throws(() => sourceIdentity(options), /exact clean checkout/);
  }
});

test("rejects tampered identity, report metadata and measured bytes", async (context) => {
  const options = await fixture(context);
  await runEvidence("--record", options);
  const original = await readManifest(options.root);
  for (const key of Object.keys(original.identity)) {
    const manifest = structuredClone(original);
    manifest.identity[key] = "tampered";
    await putManifest(options.root, manifest);
    await assert.rejects(
      runEvidence("--verify-coverage", options),
      /does not match/,
    );
  }
  for (const change of [
    (m) => {
      m.schemaVersion = 2;
    },
    (m) => {
      m.coverage[0].path = "../lcov.info";
    },
    (m) => {
      m.coverage[0].bytes++;
    },
    (m) => {
      m.coverage[0].sha256 = "0".repeat(64);
    },
    (m) => {
      m.identity.extra = "not-attested";
    },
  ]) {
    const manifest = structuredClone(original);
    change(manifest);
    await putManifest(options.root, manifest);
    await assert.rejects(
      runEvidence("--verify-coverage", options),
      /does not match/,
    );
  }
  await putManifest(options.root, original);
  await writeFile(
    path.join(options.root, "coverage/unit/lcov.info"),
    lcov().replace("DA:1,1", "DA:1,0"),
  );
  await assert.rejects(
    runEvidence("--verify-coverage", options),
    /does not match/,
  );
});

test("revalidates the actual current head, merge base, tested tree and workflow", async (context) => {
  const options = await fixture(context);
  await runEvidence("--record", options);
  for (const key of ["head", "base"]) {
    const changed = structuredClone(options.event);
    changed.pull_request[key].sha = "f".repeat(40);
    await assert.rejects(
      runEvidence("--verify-coverage", { ...options, event: changed }),
      /does not match/,
    );
  }
  for (const command of ["HEAD^{tree}", "HEAD:.github/workflows/ci.yml"]) {
    await assert.rejects(
      runEvidence("--verify-coverage", {
        ...options,
        git: (args) =>
          args[1] === command ? "f".repeat(40) : options.git(args),
      }),
      /does not match/,
    );
  }
});

test("suite artifacts remain independent across failed-job and analysis reruns", async (context) => {
  const options = await fixture(context);
  await runEvidence("--record", options);
  const governance = {
    ...options,
    environment: {
      ...options.environment,
      CI_EVIDENCE_SUITE: "governance",
      GITHUB_RUN_ATTEMPT: "2",
      CI_EVIDENCE_PRODUCER_ATTEMPT: "2",
    },
  };
  await runEvidence("--record", governance);
  const rerunUnit = {
    ...options,
    environment: { ...options.environment, GITHUB_RUN_ATTEMPT: "3" },
  };
  const rerunGovernance = {
    ...governance,
    environment: { ...governance.environment, GITHUB_RUN_ATTEMPT: "3" },
  };
  await runEvidence("--verify-coverage", rerunUnit);
  await runEvidence("--verify-coverage", rerunGovernance);
  const report = path.join(options.root, "coverage/governance/lcov.info");
  await writeFile(report, lcov().replace("DA:1,1", "DA:1,0"));
  await runEvidence("--verify-coverage", rerunUnit);
  await assert.rejects(
    runEvidence("--verify-coverage", rerunGovernance),
    /does not match/,
  );
  assert.deepEqual(options.outputs, [
    { artifact: "coverage-unit-123-1", attempt: "1" },
    { artifact: "coverage-governance-123-2", attempt: "2" },
    { powershell_report: "coverage/governance/powershell.xml" },
  ]);
});

test("rejects an unknown suite and a mismatched suite attestation", async (context) => {
  const options = await fixture(context);
  for (const suite of [undefined, "", "../unit", "other"]) {
    await assert.rejects(
      runEvidence("--record", {
        ...options,
        environment: { ...options.environment, CI_EVIDENCE_SUITE: suite },
      }),
      /declared unit or governance suite/,
    );
  }
  await runEvidence("--record", options);
  const attestation = await readManifest(options.root);
  attestation.suite = "governance";
  await putManifest(options.root, attestation);
  await assert.rejects(
    runEvidence("--verify-coverage", options),
    /does not match/,
  );
});

test("analysis reruns accept only the exact successful producer attempt output", async (context) => {
  const options = await fixture(context);
  await runEvidence("--record", options);
  options.environment.GITHUB_RUN_ATTEMPT = "2";
  await runEvidence("--verify-coverage", options);
  for (const attempt of [undefined, "0", "3", "2"]) {
    await assert.rejects(
      runEvidence("--verify-coverage", {
        ...options,
        environment: {
          ...options.environment,
          CI_EVIDENCE_PRODUCER_ATTEMPT: attempt,
        },
      }),
      attempt === "2"
        ? /does not match/
        : /producer attempt|exact clean checkout/,
    );
  }
  await assert.rejects(
    runEvidence("--verify-coverage", {
      ...options,
      environment: { ...options.environment, GITHUB_RUN_ID: "124" },
    }),
    /does not match/,
  );
});

test("rejects empty, truncated and malformed LCOV", async (context) => {
  const options = await fixture(context);
  for (const bytes of [
    "",
    "not a report",
    "SF:src/example.ts\nDA:1,1\n",
    "SF:src/example.ts\nend_of_record\n",
    "DA:1,1\nend_of_record\n",
    lcov().replace("DA:1,1", "DA:1,-1"),
    lcov().replace("DA:1,1", "DA:0,1"),
    lcov().replace("end_of_record", "SF:src/example.ts"),
    Buffer.from([255]),
  ]) {
    await writeFile(path.join(options.root, "coverage/unit/lcov.info"), bytes);
    await assert.rejects(readCoverage(options.root));
  }
});

test("rejects oversized coverage before reading report contents", async (context) => {
  const options = await fixture(context);
  await truncate(
    path.join(options.root, "coverage/unit/lcov.info"),
    maximumCoverageBytes + 1,
  );
  await assert.rejects(readCoverage(options.root), /at most 32 MiB/);
});

test("validates every source in a report containing multiple records", async (context) => {
  const options = await fixture(context);
  await writeFile(path.join(options.root, "src/another.ts"), "export {};\n");
  const report = lcov() + lcov("src/another.ts");
  await writeFile(path.join(options.root, "coverage/unit/lcov.info"), report);
  assert.equal((await readCoverage(options.root)).toString(), report);

  await writeFile(
    path.join(options.root, "coverage/unit/lcov.info"),
    report + lcov("src/missing.ts"),
  );
  await assert.rejects(readCoverage(options.root), { code: "ENOENT" });
});

test("rejects absolute, escaping, ambiguous and missing source paths", async (context) => {
  const options = await fixture(context);
  for (const source of [
    "../example.ts",
    "/src/example.ts",
    "C:\\src\\example.ts",
    "\\\\host\\src\\example.ts",
    "file:src/example.ts",
    "src/../example.ts",
    "src//example.ts",
    "src/./example.ts",
    "src/missing.ts",
  ]) {
    await writeFile(
      path.join(options.root, "coverage/unit/lcov.info"),
      lcov(source),
    );
    await assert.rejects(readCoverage(options.root));
  }
});

test("rejects linked coverage and source directories without following their contents", async (context) => {
  const options = await fixture(context);
  await mkdir(path.join(options.root, "linked-source"));
  await writeFile(
    path.join(options.root, "linked-source/example.ts"),
    "synthetic source",
  );
  await symlink(
    path.join(options.root, "linked-source"),
    path.join(options.root, "src/link"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await writeFile(
    path.join(options.root, "coverage/unit/lcov.info"),
    lcov("src/link/example.ts"),
  );
  await assert.rejects(readCoverage(options.root), /must not contain links/);
  await rm(path.join(options.root, "coverage"), { recursive: true });
  await mkdir(path.join(options.root, "linked-coverage/unit"), {
    recursive: true,
  });
  await writeFile(
    path.join(options.root, "linked-coverage/unit/lcov.info"),
    lcov(),
  );
  await symlink(
    path.join(options.root, "linked-coverage"),
    path.join(options.root, "coverage"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(readCoverage(options.root), /must not contain links/);
});

test("fails closed for missing, oversized, invalid or non-file manifests", async (context) => {
  const options = await fixture(context);
  await assert.rejects(runEvidence("--verify-coverage", options), {
    code: "ENOENT",
  });
  const filename = path.join(options.root, "coverage/unit/ci-evidence.json");
  await writeFile(filename, "invalid JSON");
  await assert.rejects(runEvidence("--verify-coverage", options), SyntaxError);
  await truncate(filename, 16 * 1024 + 1);
  await assert.rejects(runEvidence("--verify-coverage", options), /too large/);
  await rm(filename);
  await mkdir(filename);
  await assert.rejects(
    runEvidence("--record", options),
    /must not contain links/,
  );
});

test("CLI handler publishes the artifact and rejects tampering in an isolated subprocess", async (context) => {
  const options = await fixture(context);
  const eventPath = path.join(options.root, "event.json");
  const outputPath = path.join(options.root, "output.txt");
  await writeFile(eventPath, JSON.stringify(options.event));
  const environment = {
    ...options.environment,
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_OUTPUT: outputPath,
  };
  const script = `import { runEvidence } from ${JSON.stringify(new URL("./ci-evidence.mjs", import.meta.url).href)};
    const input = JSON.parse(process.argv[1]);
    const values = ${JSON.stringify({ "rev-parse HEAD": commit, "rev-parse HEAD^{tree}": tree, "rev-parse HEAD:.github/workflows/ci.yml": workflow, "diff --name-only HEAD --": "" })};
    await runEvidence(process.argv[2], { ...input, git: args => values[args.join(" ")] });`;
  const run = (mode) =>
    spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        script,
        JSON.stringify({ root: options.root, environment }),
        mode,
      ],
      { cwd: options.root, encoding: "utf8", windowsHide: true },
    );
  assert.equal(run("--record").status, 0);
  assert.equal(
    await readFile(outputPath, "utf8"),
    "artifact=coverage-unit-123-1\nattempt=1\n",
  );
  assert.equal(run("--verify-coverage").status, 0);
  await writeFile(
    path.join(options.root, "coverage/unit/lcov.info"),
    lcov().replace("DA:1,1", "DA:1,0"),
  );
  const failed = run("--verify-coverage");
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /does not match/);
  const invalid = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./ci-evidence.mjs", import.meta.url)), "--invalid"],
    { cwd: options.root, encoding: "utf8", windowsHide: true },
  );
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Usage:/);
});

test(
  "direct CLI records and verifies evidence from a real synthetic Git checkout",
  {
    skip: existsSync(gitExecutable)
      ? false
      : "The native Git executable is unavailable on this host.",
  },
  async (context) => {
    const { root } = await fixture(context);
    await mkdir(path.join(root, ".github/workflows"), { recursive: true });
    await mkdir(path.join(root, "scripts"), { recursive: true });
    await writeFile(
      path.join(root, ".github/workflows/ci.yml"),
      "name: Synthetic CI\non: push\njobs: {}\n",
    );
    const scriptPath = path.join(root, "scripts/ci-evidence.mjs");
    await copyFile(new URL("./ci-evidence.mjs", import.meta.url), scriptPath);
    const git = (...args) => {
      const result = spawnSync(gitExecutable, args, {
        cwd: root,
        encoding: "utf8",
        env: {
          GIT_CONFIG_GLOBAL: emptyConfig,
          GIT_CONFIG_NOSYSTEM: "1",
          SystemRoot: process.env.SystemRoot,
        },
        windowsHide: true,
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    git("init");
    git("config", "user.name", "Synthetic CI Fixture");
    git("config", "user.email", "ci-fixture@example.invalid");
    git("config", "commit.gpgSign", "false");
    git("config", "core.hooksPath", emptyConfig);
    git(
      "add",
      ".github/workflows/ci.yml",
      "src/example.ts",
      "coverage/unit/lcov.info",
    );
    git("commit", "-m", "test: create synthetic CI evidence fixture");
    const fixtureCommit = git("rev-parse", "HEAD");
    const fixtureTree = git("rev-parse", "HEAD^{tree}");
    const fixtureWorkflow = git("rev-parse", "HEAD:.github/workflows/ci.yml");
    const eventPath = path.join(root, "event.json");
    const outputPath = path.join(root, "output.txt");
    await writeFile(
      eventPath,
      JSON.stringify({
        repository: { full_name: "example/api" },
        pull_request: {
          head: { sha: fixtureCommit },
          base: { sha: fixtureCommit, repo: { full_name: "example/api" } },
        },
      }),
    );
    const environment = {
      SystemRoot: process.env.SystemRoot,
      CI_EVIDENCE_PRODUCER_ATTEMPT: "2",
      CI_EVIDENCE_SUITE: "unit",
      GIT_CONFIG_GLOBAL: emptyConfig,
      GIT_CONFIG_NOSYSTEM: "1",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_OUTPUT: outputPath,
      GITHUB_REPOSITORY: "example/api",
      GITHUB_RUN_ATTEMPT: "2",
      GITHUB_RUN_ID: "456",
      GITHUB_SHA: fixtureCommit,
    };
    const run = (mode) =>
      spawnSync(process.execPath, [scriptPath, mode], {
        cwd: root,
        encoding: "utf8",
        env: environment,
        windowsHide: true,
      });

    const recorded = run("--record");
    assert.equal(recorded.status, 0, recorded.stderr);
    assert.equal(
      await readFile(outputPath, "utf8"),
      "artifact=coverage-unit-456-2\nattempt=2\n",
    );
    assert.deepEqual((await readManifest(root)).identity, {
      repository: "example/api",
      head: fixtureCommit,
      base: fixtureCommit,
      commit: fixtureCommit,
      tree: fixtureTree,
      workflow: fixtureWorkflow,
      runId: "456",
      attempt: "2",
    });
    const verified = run("--verify-coverage");
    assert.equal(verified.status, 0, verified.stderr);
  },
);
