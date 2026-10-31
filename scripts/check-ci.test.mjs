import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parse, stringify } from "yaml";

import {
  coverageManifest,
  createEvidenceRunner,
  inspectCi,
  inspectSonarWorkflow,
  lighthouseException,
  reusableCoverageCandidate,
  selectPerformanceScope,
  selectVerificationScope,
  validateCoverageIdentity,
  verifyCoverageManifest,
  verifyReusedCoverage,
  visualInputsChanged,
} from "./check-ci.mjs";

const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const workflow = () => parse(read(".github/workflows/ci.yml"));
const manifest = () => JSON.parse(read(".agents/validation.json"));
const applicationManifest = () => {
  const value = manifest();
  value.applicationReady = true;
  value.phase = "application-verification";
  for (const [id, command, kind] of [
    ["unused", "npm run check:unused", "required"],
    ["application-build", "npm run build:verification", "required"],
    ["bundle", "npm run check:bundle", "required"],
    ["contract", "npm run test:contract", "required"],
    ["application-e2e", "npm run test:e2e", "required"],
    ["browser-compatibility", "npm run test:e2e:complete", "manual"],
    ["visual", "npm run test:visual", "manual"],
    ["lighthouse", "npm run test:lighthouse:verified", "advisory"],
  ])
    if (!value.checks.some((check) => check.id === id))
      value.checks.push({
        id,
        command,
        kind,
        ciJobs: ["check"],
        scopes: ["application-verification"],
        ...(id === "lighthouse"
          ? {
              exception: {
                ...lighthouseException,
                reason: "Synthetic bounded exception",
              },
            }
          : {}),
      });
  value.profiles.full = value.checks
    .filter((check) => check.kind === "required")
    .map((check) => check.id);
  value.profiles.complete = [
    ...value.profiles.full.slice(0, -1),
    "browser-compatibility",
    "visual",
  ];
  value.profiles.visual = ["visual"];
  value.profiles.performance = ["lighthouse"];
  return value;
};
const changedWorkflow = (change) => {
  const value = workflow();
  change(value);
  return stringify(value);
};
const command = (value, text, name = "check") =>
  value.jobs[name].steps.find((step) => step.run === text);
const canonical = "npm run validate -- ${{ needs.scope.outputs.profile }}";
const browsers = "npm run ${{ needs.scope.outputs.browser_install }}";

test("the actual workflow runs core verification once and reuses measured coverage for one scanner", () => {
  assert.deepEqual(inspectCi(read(".github/workflows/ci.yml"), manifest()), {
    requiredChecks: manifest().profiles.full.length,
  });
  assert.deepEqual(
    inspectSonarWorkflow(read(".github/workflows/ci.yml"), manifest()),
    { requiredChecks: manifest().profiles.full.length },
  );
  assert.deepEqual(Object.keys(workflow().jobs).sort(), [
    "analysis",
    "check",
    "scope",
  ]);
});

test("CI preserves PR lifecycle and base retargeting, scheduled compatibility and manual release verification", () => {
  for (const change of [
    (value) => {
      delete value.on.pull_request;
    },
    ...["paths", "paths-ignore", "branches", "branches-ignore"].map(
      (key) => (value) => {
        value.on.pull_request[key] = ["src/**"];
      },
    ),
    ...["opened", "synchronize", "reopened", "edited", "ready_for_review"].map(
      (name) => (value) => {
        value.on.pull_request.types = value.on.pull_request.types.filter(
          (type) => type !== name,
        );
      },
    ),
    (value) => {
      value.on.pull_request_target = {};
    },
    (value) => {
      delete value.on.schedule;
    },
    (value) => {
      value.on.workflow_dispatch.inputs.verification.default = "full";
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /lifecycle|filters|retargeting|pre-release|Privileged/,
    );
});

test("scope selection cannot be hidden or depend on a filtered prerequisite", () => {
  for (const change of [
    (value) => {
      delete value.jobs.scope;
    },
    (value) => {
      value.jobs.scope.if = "false";
    },
    (value) => {
      value.jobs.scope.needs = "other";
    },
    (value) => {
      command(value, "node scripts/check-ci.mjs --scope", "scope").run +=
        " || true";
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /blocking Windows|Scope selection|exactly once|one execution owner/,
    );
});

test("the check job retains its native status, exact scope dependency and blocking execution", () => {
  for (const change of [
    (value) => {
      delete value.jobs.check;
    },
    (value) => {
      value.jobs.check.name = "pretend-ready";
    },
    (value) => {
      value.jobs.check.if = "needs.scope.outputs.run == 'true'";
    },
    (value) => {
      value.jobs.check.needs = "other";
    },
    (value) => {
      value.jobs.check.strategy = { matrix: {} };
    },
    (value) => {
      value.jobs.check["continue-on-error"] = true;
    },
    (value) => {
      value.jobs.check["runs-on"] = "ubuntu-latest";
    },
    ...["build", "e2e", "visual"].map((name) => (value) => {
      value.jobs[name] = structuredClone(value.jobs.check);
    }),
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /one execution owner|blocking Windows|native check/,
    );
});

test("canonical installation, selected browsers and profile cannot be omitted, repeated, aliased or failure-ignored", () => {
  for (const text of ["npm ci", browsers, canonical]) {
    for (const change of [
      (value) => {
        value.jobs.check.steps = value.jobs.check.steps.filter(
          (step) => step !== command(value, text),
        );
      },
      (value) => {
        value.jobs.check.steps.push({ run: text });
      },
      (value) => {
        command(value, text).run += " || true";
      },
      (value) => {
        command(value, text).run += "-alias";
      },
      (value) => {
        command(value, text).if = "always()";
      },
      (value) => {
        command(value, text)["continue-on-error"] = true;
      },
      (value) => {
        command(value, text).uses = "synthetic/action@pin";
      },
    ])
      assert.throws(
        () => inspectCi(changedWorkflow(change), manifest()),
        /exactly once|blocking|duplicate|unregistered/,
      );
  }
});

test("setup must precede dependency installation and selected browsers before the profile", () => {
  for (const text of ["npm ci", browsers]) {
    const value = workflow();
    const step = command(value, text);
    value.jobs.check.steps = value.jobs.check.steps.filter(
      (item) => item !== step,
    );
    value.jobs.check.steps.push(step);
    assert.throws(
      () => inspectCi(stringify(value), manifest()),
      /before canonical/,
    );
  }
});

test("canonical commands remain visible behind shell separators, redirection and parentheses", () => {
  for (const text of ["npm ci", browsers, canonical]) {
    for (const extra of [
      `${text}\necho duplicate`,
      `echo ignored; ${text}`,
      `${text}>report.txt`,
      `(${text})`,
    ]) {
      const value = workflow();
      value.jobs.check.steps.push({ run: extra });
      assert.throws(
        () => inspectCi(stringify(value), manifest()),
        /exactly once|duplicate|unregistered/,
      );
    }
  }
});

test("direct suite and build execution outside the profile is rejected instead of duplicating work", () => {
  for (const text of [
    "npm run build",
    "npm run test:e2e",
    "npm run test:visual",
    "npm run validate -- full",
  ]) {
    const value = workflow();
    value.jobs.check.steps.push({ run: text });
    assert.throws(
      () => inspectCi(stringify(value), manifest()),
      /duplicate|unregistered/,
    );
  }
});

test("workflow, job and step scope cannot redirect execution or replace the shell", () => {
  for (const change of [
    (value) => {
      value.defaults = { run: { "working-directory": "other" } };
    },
    (value) => {
      value.jobs.check.defaults = { run: { shell: "echo {0}" } };
    },
    (value) => {
      command(value, canonical)["working-directory"] = "other";
    },
    (value) => {
      command(value, browsers).shell = "bash";
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /repository root|default shell/,
    );
});

test("all checkout and Node actions must be pinned, blocking, ordered and use the exact source", () => {
  for (const name of ["scope", "check", "analysis"]) {
    for (const prefix of ["actions/checkout", "actions/setup-node"]) {
      for (const change of [
        (job, step) => {
          job.steps = job.steps.filter((item) => item !== step);
        },
        (_job, step) => {
          step.uses = prefix + "@latest";
        },
        (_job, step) => {
          step.if = "always()";
        },
        (_job, step) => {
          step["continue-on-error"] = true;
        },
        (_job, step) => {
          step.run = "echo not-an-action";
        },
        (job, step) => {
          job.steps.push(structuredClone(step));
        },
        (job, step) => {
          job.steps = job.steps.filter((item) => item !== step);
          job.steps.push(step);
        },
      ]) {
        const value = workflow();
        const job = value.jobs[name];
        const step = job.steps.find((item) =>
          item.uses?.startsWith(prefix + "@"),
        );
        change(job, step);
        assert.throws(
          () => inspectCi(stringify(value), manifest()),
          /immutable pin|blocking|prerequisites|before|checkout|existing measured coverage|Metadata reuse/,
        );
      }
    }
    for (const change of [
      (step) => {
        step.with.path = "other";
      },
      (step) => {
        step.with.ref = "main";
      },
      (step) => {
        step.with["persist-credentials"] = true;
      },
    ]) {
      const value = workflow();
      change(
        value.jobs[name].steps.find((step) =>
          step.uses?.startsWith("actions/checkout@"),
        ),
      );
      assert.throws(
        () => inspectCi(stringify(value), manifest()),
        /exact tested revision/,
      );
    }
    const valid = workflow();
    valid.jobs[name].steps.find((step) =>
      step.uses?.startsWith("actions/checkout@"),
    ).with.path = ".";
    assert.doesNotThrow(() => inspectCi(stringify(valid), manifest()));
    for (const change of [
      (step) => {
        step.with["node-version-file"] = "other";
      },
      (step) => {
        step.with["node-version"] = "latest";
      },
    ]) {
      const value = workflow();
      change(
        value.jobs[name].steps.find((step) =>
          step.uses?.startsWith("actions/setup-node@"),
        ),
      );
      assert.throws(
        () => inspectCi(stringify(value), manifest()),
        /Node must use/,
      );
    }
  }
});

test("the visual step has only the conservative scope condition and is not an advisory pass", () => {
  for (const change of [
    (value) => {
      command(value, "npm run validate -- visual").if = "false";
    },
    (value) => {
      command(value, "npm run validate -- visual")["continue-on-error"] = true;
    },
    (value) => {
      value.jobs.check.steps.push({
        ...command(value, "npm run validate -- visual"),
      });
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /declared condition|exactly once/,
    );
});

test("performance cannot be omitted or remain advisory after the bounded exception", () => {
  for (const change of [
    (value) => {
      value.jobs.check.steps = value.jobs.check.steps.filter(
        (step) => step.id !== "performance",
      );
    },
    (value) => {
      command(value, "npm run validate -- performance")["continue-on-error"] =
        true;
    },
    (value) => {
      command(value, "npm run validate -- performance").if = "false";
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /advisory status must expire/,
    );
});

test("coverage publication cannot be replaced with missing, conditional or overwritten reports", () => {
  for (const change of [
    (value) => {
      command(value, "node scripts/check-ci.mjs --record-coverage").if =
        "false";
    },
    (value) => {
      value.jobs.check.steps.find((step) =>
        step.uses?.startsWith("actions/upload-artifact@"),
      ).with.overwrite = true;
    },
    (value) => {
      value.jobs.check.steps.find((step) =>
        step.uses?.startsWith("actions/upload-artifact@"),
      ).with.path = "coverage/unit/lcov.info";
    },
    (value) => {
      value.jobs.check.steps.find((step) =>
        step.uses?.startsWith("actions/upload-artifact@"),
      ).with.name = "latest";
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /declared condition|coverage must be recorded/,
    );
});

test("scope, coverage producer and analysis outputs cannot substitute another source or an unverified step", () => {
  for (const change of [
    (value) => {
      value.jobs.scope.outputs.run = "true";
    },
    (value) => {
      command(value, "node scripts/check-ci.mjs --scope", "scope").id = "other";
    },
    (value) => {
      value.jobs.check.env.VERIFICATION_HEAD = "invented";
    },
    (value) => {
      value.jobs.check.env.KERNEL_REUSE_VERIFICATION_BUILD = "0";
    },
    (value) => {
      value.jobs.check.outputs.coverage_attempt = "1";
    },
    (value) => {
      command(value, "node scripts/check-ci.mjs --record-coverage").id =
        "other";
    },
    (value) => {
      value.jobs.analysis.env.VERIFICATION_BASE = "invented";
    },
    (value) => {
      value.jobs.analysis.env.VERIFICATION_COVERAGE_ATTEMPT = "1";
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /scope outputs|exact scope|declared producer|coverage identity/,
    );
});

test("manifest ownership preserves all inherited checks and the complete matrix replaces Chromium once", () => {
  for (const change of [
    (value) => {
      value.phase = "assistant-guidance";
    },
    (value) => {
      value.profiles.full.pop();
    },
    (value) => {
      value.profiles.full.reverse();
    },
    (value) => {
      value.profiles.full[1] = value.profiles.full[0];
    },
    (value) => {
      value.checks.push({ ...value.checks[0] });
    },
    (value) => {
      value.checks[0].ciJobs = ["check", "other"];
    },
    (value) => {
      value.checks.find((check) => check.id === "contract").command =
        "npm run lint";
    },
    (value) => {
      value.profiles.complete.push("application-e2e");
    },
    (value) => {
      value.profiles.complete = value.profiles.complete.filter(
        (id) => id !== "visual",
      );
    },
    (value) => {
      value.checks.find((check) => check.id === "visual").kind = "advisory";
    },
    (value) => {
      value.checks.find((check) => check.id === "lighthouse").exception.owner =
        "";
    },
    (value) => {
      value.checks.find(
        (check) => check.id === "lighthouse",
      ).exception.expiresAt = "2027-01-01T00:00:00Z";
    },
  ]) {
    const value = applicationManifest();
    change(value);
    assert.throws(
      () => inspectCi(read(".github/workflows/ci.yml"), value),
      /phase|unique|core check|declared scope|Complete verification|bounded expiry/,
    );
  }
});

test("CI rejects duplicate YAML keys and malformed workflows", () => {
  for (const value of [
    "jobs:\n  check: {}\n  check: {}\n",
    "jobs: [",
    "- invalid",
  ])
    assert.throws(
      () => inspectCi(value, manifest()),
      /valid YAML|workflow mapping/,
    );
});

test("Sonar retains its native check, successful producer dependency and same-repository guard", () => {
  for (const change of [
    (value) => {
      delete value.jobs.analysis;
    },
    (value) => {
      value.jobs.analysis.name = "pretend-ready";
    },
    (value) => {
      value.jobs.analysis.needs = "scope";
    },
    (value) => {
      value.jobs.analysis.if = "always()";
    },
    (value) => {
      value.jobs.analysis["continue-on-error"] = true;
    },
  ])
    assert.throws(
      () => inspectSonarWorkflow(changedWorkflow(change), manifest()),
      /blocking Windows|native scanner/,
    );
});

test("Sonar verifies the exact producer artifact before scanning and never reruns tests", () => {
  for (const change of [
    (value) => {
      value.jobs.analysis.steps.find((step) =>
        step.uses?.startsWith("actions/download-artifact@"),
      ).with.name = "latest";
    },
    (value) => {
      value.jobs.analysis.steps.find((step) =>
        step.uses?.startsWith("actions/download-artifact@"),
      ).with.path = "other";
    },
    (value) => {
      command(
        value,
        "node scripts/check-ci.mjs --verify-coverage",
        "analysis",
      ).run = "echo no verification";
    },
    (value) => {
      value.jobs.analysis.steps.push({ run: "npm run validate -- full" });
    },
    (value) => {
      value.jobs.analysis.steps.push({ run: "npm ci" });
    },
    (value) => {
      const verify = command(
        value,
        "node scripts/check-ci.mjs --verify-coverage",
        "analysis",
      );
      value.jobs.analysis.steps = value.jobs.analysis.steps.filter(
        (step) => step !== verify,
      );
      value.jobs.analysis.steps.push(verify);
    },
  ])
    assert.throws(
      () => inspectSonarWorkflow(changedWorkflow(change), manifest()),
      /existing measured coverage|exactly once/,
    );
});

test("Sonar requires one immutable blocking scanner bound to the tested head and configured credentials", () => {
  const invalid = [
    "latest",
    "v8",
    "",
    "a".repeat(39),
    "a".repeat(41),
    "g".repeat(40),
  ];
  for (const change of [
    ...invalid.map((ref) => (value) => {
      value.jobs.analysis.steps.find((step) =>
        step.uses?.startsWith("SonarSource/"),
      ).uses = `SonarSource/sonarqube-scan-action@${ref}`;
    }),
    (value) => {
      value.jobs.analysis.steps.push({
        ...value.jobs.analysis.steps.find((step) =>
          step.uses?.startsWith("SonarSource/"),
        ),
      });
    },
    (value) => {
      value.jobs.analysis.steps.find((step) =>
        step.uses?.startsWith("SonarSource/"),
      ).if = "false";
    },
    (value) => {
      value.jobs.analysis.steps.find((step) =>
        step.uses?.startsWith("SonarSource/"),
      )["continue-on-error"] = true;
    },
    (value) => {
      value.jobs.analysis.steps.find((step) =>
        step.uses?.startsWith("SonarSource/"),
      ).with.args = "-Dsonar.projectKey=other";
    },
    (value) => {
      delete value.jobs.analysis.steps.find((step) =>
        step.uses?.startsWith("SonarSource/"),
      ).env.SONAR_TOKEN;
    },
  ])
    assert.throws(
      () => inspectSonarWorkflow(changedWorkflow(change), manifest()),
      /immutable pin|blocking|configured credentials/,
    );
});

const commit = "a".repeat(40);
const tree = "b".repeat(40);
const base = "c".repeat(40);
const head = "d".repeat(40);
const scope = (overrides = {}) =>
  selectVerificationScope({
    event: {
      action: "synchronize",
      pull_request: { head: { sha: head }, base: { sha: base } },
    },
    eventName: "pull_request",
    commit,
    tree,
    files: ["src/app/App.tsx"],
    now: "2026-10-31T00:00:00Z",
    ...overrides,
  });

test("title/body edits avoid duplicate verification while retargeting a base always invalidates it", () => {
  for (const changes of [
    { title: { from: "old" } },
    { body: { from: "old" } },
    {},
  ]) {
    const event = {
      action: "edited",
      changes,
      pull_request: { head: { sha: head }, base: { sha: base } },
    };
    assert.equal(scope({ event }).run, "false");
    assert.equal(scope({ event }).visual, "false");
  }
  const event = {
    action: "edited",
    changes: { base: { ref: { from: "other" } } },
    pull_request: { head: { sha: head }, base: { sha: base } },
  };
  assert.equal(scope({ event, files: ["docs/testing.md"] }).run, "true");
  assert.equal(scope({ event, files: ["docs/testing.md"] }).visual, "true");
});

test("complete verification is selected for nightly and explicit pre-release events without a second Chromium suite", () => {
  for (const input of [
    { eventName: "schedule", event: {} },
    {
      eventName: "workflow_dispatch",
      event: { inputs: { verification: "complete" } },
    },
  ]) {
    const value = scope({ ...input, files: [] });
    assert.equal(value.profile, "complete");
    assert.equal(value.browser_install, "browser:install:all");
    assert.equal(value.visual, "true");
  }
  assert.equal(scope().profile, "full");
  assert.equal(scope().browser_install, "browser:install");
});

test("visual input selection includes all rendering/dependency/fixture inputs and unknown files", () => {
  for (const file of [
    "src/app/App.tsx",
    "src/shared/i18n/locales/fa.ts",
    "public/logo.svg",
    "src/assets/fonts/font.woff2",
    "e2e/fixtures.ts",
    "e2e/visual/baselines/application/win32/metadata.json",
    "scripts/run-visual.mjs",
    "vite.config.ts",
    "playwright.visual.config.ts",
    "package-lock.json",
    ".nvmrc",
    ".github/workflows/ci.yml",
    "new-config.json",
  ])
    assert.equal(visualInputsChanged([file]), true, file);
  assert.equal(
    visualInputsChanged([
      "docs/testing.md",
      "README.fa.md",
      "AGENTS.md",
      ".agents/README.md",
    ]),
    false,
  );
  assert.equal(visualInputsChanged([]), false);
  for (const file of [
    "../private",
    "src/../private",
    "C:\\private",
    "src/file\nother",
    "",
  ])
    assert.throws(() => visualInputsChanged([file]), /safe repository/);
});

test("the Lighthouse exception stops automatically at its exact review deadline", () => {
  assert.equal(
    selectPerformanceScope("2026-11-06T23:59:59.999Z").advisory,
    "true",
  );
  assert.equal(
    selectPerformanceScope(lighthouseException.expiresAt).advisory,
    "false",
  );
  assert.equal(
    selectPerformanceScope("2026-11-08T00:00:00Z").advisory,
    "false",
  );
  assert.throws(
    () => selectPerformanceScope("invalid"),
    /valid verification time/,
  );
});

test("scope identity rejects unsupported or malformed events and exact source identities", () => {
  for (const change of [
    { eventName: "pull_request_target" },
    { commit: "main" },
    { tree: "0".repeat(40) },
    { event: { pull_request: { head: { sha: "main" }, base: { sha: base } } } },
  ])
    assert.throws(
      () => scope(change),
      /Unsupported|verified event|exact commits/,
    );
});

const identity = () => ({
  repository: "synthetic/project",
  head,
  base,
  commit,
  tree,
  runId: "123",
  runAttempt: "2",
});
const contents = () => ({
  "coverage/unit/lcov.info": Buffer.from(
    "SF:src/value.ts\nDA:1,1\nend_of_record\n",
  ),
  "coverage/governance/lcov.info": Buffer.from(
    "SF:scripts/check.mjs\nDA:1,1\nend_of_record\n",
  ),
});

test("coverage reuse is bound to exact repository/head/base/merge commit/tree and producer run/attempt", () => {
  const report = coverageManifest(identity(), contents());
  assert.equal(verifyCoverageManifest(report, identity(), contents()), true);
  for (const [key, value] of Object.entries({
    repository: "other/project",
    head: base,
    base: head,
    commit: tree,
    tree: commit,
    runId: "124",
    runAttempt: "3",
  })) {
    const changed = { ...identity(), [key]: value };
    assert.throws(
      () => verifyCoverageManifest(report, changed, contents()),
      /exact tested source/,
    );
  }
});

test("coverage reuse rejects missing, forged, altered and extra LCOV content", () => {
  const report = coverageManifest(identity(), contents());
  for (const mutate of [
    (value) => {
      value["coverage/unit/lcov.info"] = Buffer.from(
        "SF:src/value.ts\nDA:1,0\nend_of_record\n",
      );
    },
    (value) => {
      delete value["coverage/governance/lcov.info"];
    },
    (value) => {
      value["coverage/governance/lcov.info"] = Buffer.from(
        "not measured coverage",
      );
    },
    (value) => {
      value["private.env"] = Buffer.from("never permitted");
    },
  ]) {
    const value = contents();
    mutate(value);
    assert.throws(
      () => verifyCoverageManifest(report, identity(), value),
      /LCOV|exact tested source/,
    );
  }
  for (const mutate of [
    (value) => {
      value.schemaVersion = 2;
    },
    (value) => {
      value.files[0].path = "../private";
    },
    (value) => {
      value.files[0].sha256 = "0".repeat(64);
    },
    (value) => {
      value.identity.extra = "unexpected";
    },
  ]) {
    const value = structuredClone(report);
    mutate(value);
    assert.throws(
      () => verifyCoverageManifest(value, identity(), contents()),
      /exact tested source/,
    );
  }
});

test("coverage provenance accepts only exact, finite public producer identities", () => {
  for (const [key, value] of Object.entries({
    repository: "../private",
    head: "main",
    base: "0".repeat(40),
    commit: "missing",
    tree: "",
    runId: "1\nother",
    runAttempt: "0",
  }))
    assert.throws(
      () => validateCoverageIdentity({ ...identity(), [key]: value }),
      /Coverage identity/,
    );
});

test("metadata reuse accepts an actual successful producer with exact source/base/tree and original measured bytes", () => {
  const expected = identity();
  const run = {
    id: 122,
    status: "completed",
    conclusion: "success",
    head_sha: head,
    head_repository: { full_name: expected.repository },
    path: ".github/workflows/ci.yml",
    updated_at: "2026-10-31T01:00:00Z",
  };
  const artifact = { name: "verification-122-2", expired: false };
  const candidate = reusableCoverageCandidate([run], [artifact], expected);
  assert.deepEqual(candidate, {
    artifact: artifact.name,
    runId: "122",
    runAttempt: "2",
  });
  const producer = {
    ...expected,
    runId: "122",
    runAttempt: "2",
    commit: "e".repeat(40),
  };
  const report = coverageManifest(producer, contents());
  assert.deepEqual(
    verifyReusedCoverage(report, expected, candidate, run, contents()),
    producer,
  );
  for (const change of [
    (value) => {
      value.identity.head = base;
    },
    (value) => {
      value.identity.base = head;
    },
    (value) => {
      value.identity.tree = commit;
    },
    (value) => {
      value.identity.runId = "121";
    },
    (value) => {
      value.files[0].sha256 = "0".repeat(64);
    },
  ]) {
    const value = structuredClone(report);
    change(value);
    assert.throws(
      () => verifyReusedCoverage(value, expected, candidate, run, contents()),
      /exact tested source/,
    );
  }
});

test("metadata edits cannot turn a latest failed, pending, canceled or missing verification into a pass", () => {
  const passed = {
    id: 121,
    status: "completed",
    conclusion: "success",
    head_sha: head,
    head_repository: { full_name: identity().repository },
    path: ".github/workflows/ci.yml",
    updated_at: "2026-10-31T00:00:00Z",
  };
  const artifact = { name: "verification-121-1", expired: false };
  for (const state of [
    { status: "completed", conclusion: "failure" },
    { status: "in_progress", conclusion: null },
    { status: "completed", conclusion: "cancelled" },
  ]) {
    const latest = {
      ...passed,
      ...state,
      id: 120,
      updated_at: "2026-10-31T02:00:00Z",
    };
    assert.equal(
      reusableCoverageCandidate([passed, latest], [artifact], identity()),
      undefined,
    );
    assert.throws(
      () =>
        verifyReusedCoverage(
          coverageManifest(
            { ...identity(), runId: "121", runAttempt: "1" },
            contents(),
          ),
          identity(),
          { artifact: artifact.name, runId: "121", runAttempt: "1" },
          latest,
          contents(),
        ),
      /successful CI producer/,
    );
  }
  assert.equal(reusableCoverageCandidate([], [], identity()), undefined);
  assert.equal(
    reusableCoverageCandidate(
      [passed],
      [{ ...artifact, expired: true }],
      identity(),
    ),
    undefined,
  );
  assert.equal(
    reusableCoverageCandidate(
      [{ ...passed, head_sha: base }],
      [artifact],
      identity(),
    ),
    undefined,
  );
  assert.equal(
    reusableCoverageCandidate(
      [{ ...passed, head_repository: { full_name: "other/project" } }],
      [artifact],
      identity(),
    ),
    undefined,
  );
});

test("application metadata cannot reuse an advisory performance failure after expiry while the prerequisite phase gains no performance gate", () => {
  const expected = identity();
  const run = {
    id: 122,
    status: "completed",
    conclusion: "success",
    head_sha: head,
    head_repository: { full_name: expected.repository },
    path: ".github/workflows/ci.yml",
  };
  const candidate = {
    artifact: "verification-122-2",
    runId: "122",
    runAttempt: "2",
  };
  const report = coverageManifest(
    { ...expected, runId: "122", runAttempt: "2" },
    contents(),
    {
      applicationReady: true,
      performanceAdvisory: true,
      performanceOutcome: "failure",
      recordedAt: "2026-11-06T23:00:00Z",
    },
  );
  assert.doesNotThrow(() =>
    verifyReusedCoverage(report, expected, candidate, run, contents(), {
      applicationReady: true,
      now: "2026-11-06T23:59:59Z",
    }),
  );
  assert.throws(
    () =>
      verifyReusedCoverage(report, expected, candidate, run, contents(), {
        applicationReady: true,
        now: lighthouseException.expiresAt,
      }),
    /exception expired/,
  );
  const blocking = structuredClone(report);
  blocking.verification.performanceAdvisory = false;
  blocking.verification.performanceOutcome = "success";
  assert.doesNotThrow(() =>
    verifyReusedCoverage(blocking, expected, candidate, run, contents(), {
      applicationReady: true,
      now: "2026-11-08T00:00:00Z",
    }),
  );
  const prerequisite = coverageManifest(
    { ...expected, runId: "122", runAttempt: "2" },
    contents(),
    { applicationReady: false },
  );
  assert.doesNotThrow(() =>
    verifyReusedCoverage(prerequisite, expected, candidate, run, contents(), {
      applicationReady: false,
      now: "2026-11-08T00:00:00Z",
    }),
  );
});

test("Sonar installs locked analysis types once without package scripts or repeated test execution", () => {
  for (const change of [
    (value) => {
      command(value, "npm ci --ignore-scripts", "analysis").run = "npm ci";
    },
    (value) => {
      command(value, "npm ci --ignore-scripts", "analysis").run =
        "npm ci --ignore-scripts || true";
    },
    (value) => {
      command(value, "npm ci --ignore-scripts", "analysis")[
        "continue-on-error"
      ] = true;
    },
    (value) => {
      value.jobs.analysis.steps.push({ run: "npm ci --ignore-scripts" });
    },
  ])
    assert.throws(
      () => inspectSonarWorkflow(changedWorkflow(change), manifest()),
      /exactly once|blocking/,
    );
});

test("protected checks fail closed on missing scope and performance expiry is refreshed in the execution job", () => {
  for (const change of [
    (value) => {
      value.jobs.check.if = "needs.scope.outputs.run == 'true'";
    },
    (value) => {
      value.jobs.check.steps.shift();
    },
    (value) => {
      value.jobs.check.steps[0].run = "echo accepted";
    },
    (value) => {
      value.concurrency.group = "ci-${{ github.ref }}";
    },
    (value) => {
      command(value, "npm run validate -- performance")["continue-on-error"] =
        "${{ needs.scope.outputs.lighthouse_advisory == 'true' }}";
    },
    (value) => {
      command(value, "node scripts/check-ci.mjs --performance-scope").if =
        "false";
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /native check|scope selection|not cancel|expire|declared condition/,
    );
});

test("the shared normalized workflow keeps the non-runnable phase at its real twelve-check scope", () => {
  const value = scope({
    applicationReady: false,
    eventName: "workflow_dispatch",
    event: { inputs: { verification: "complete" } },
  });
  assert.equal(value.application, "false");
  assert.equal(value.profile, "full");
  assert.equal(value.browser_install, "browser:install");
  assert.equal(value.visual, "false");
  const fixture = manifest();
  fixture.applicationReady = false;
  fixture.phase = "assistant-guidance";
  fixture.checks = fixture.checks.filter((check) =>
    check.scopes.includes("assistant-guidance"),
  );
  fixture.profiles.full = fixture.checks
    .filter((check) => check.kind === "required")
    .map((check) => check.id);
  assert.deepEqual(inspectCi(read(".github/workflows/ci.yml"), fixture), {
    requiredChecks: 12,
  });
});

test("historical minimal workflow fixtures retain blocking canonical execution without the normalized model marker", () => {
  const legacy = {
    checks: [
      {
        id: "types",
        command: "npm run typecheck",
        kind: "required",
        ciJobs: ["check"],
      },
    ],
    profiles: { full: ["types"] },
  };
  const steps = [
    { run: "npm ci" },
    { run: "npm run browser:install" },
    { run: "npm run validate -- full" },
  ];
  const ci = {
    on: { pull_request: null },
    jobs: { check: { steps: structuredClone(steps) } },
  };
  const sonar = {
    on: { pull_request: null },
    jobs: {
      analysis: {
        steps: [
          ...structuredClone(steps),
          { uses: "SonarSource/sonarqube-scan-action@" + "a".repeat(40) },
        ],
      },
    },
  };
  assert.deepEqual(inspectCi(stringify(ci), legacy), { requiredChecks: 1 });
  assert.deepEqual(inspectSonarWorkflow(stringify(sonar), legacy), {
    requiredChecks: 1,
  });
  const reordered = structuredClone(legacy);
  reordered.checks.unshift({
    id: "lint",
    command: "npm run lint",
    kind: "required",
    ciJobs: ["check"],
  });
  reordered.profiles.full.push("lint");
  assert.deepEqual(inspectCi(stringify(ci), reordered), { requiredChecks: 2 });
  for (const advisory of ["if", "continue-on-error"]) {
    const value = structuredClone(ci);
    value.jobs.check.steps[2][advisory] = advisory === "if" ? "always()" : true;
    assert.throws(() => inspectCi(stringify(value), legacy), /blocking/);
  }
});

test("Sonar analyzes the declared phase and classifies its fixtures without weakening coverage or duplication", () => {
  const properties = Object.fromEntries(
    read("sonar-project.properties")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  const application = manifest().applicationReady === true;
  assert.deepEqual(properties["sonar.sources"].split(","), [
    "src",
    "scripts",
    ".storybook",
    ".agents/hooks",
    "deploy",
    "tooling",
    ...(application
      ? [
          "vite.config.ts",
          "playwright.config.ts",
          "playwright.visual.config.ts",
          "vitest.contract.config.ts",
        ]
      : []),
  ]);
  assert.deepEqual(properties["sonar.tests"].split(","), [
    "src",
    "scripts",
    ".storybook",
    ...(application ? ["e2e", "contract"] : []),
  ]);
  const fixtures = [
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/test/**",
    "scripts/*.test.mjs",
    "src/**/*.stories.tsx",
    ".storybook/**",
    ...(application ? ["e2e/**", "contract/**"] : []),
  ];
  assert.deepEqual(properties["sonar.test.inclusions"].split(","), fixtures);
  assert.deepEqual(properties["sonar.exclusions"].split(","), fixtures);
  assert.deepEqual(
    Object.keys(properties)
      .filter((key) => key.endsWith("exclusions"))
      .sort(),
    ["sonar.cpd.exclusions", "sonar.exclusions"],
  );
  assert.equal(
    properties["sonar.cpd.exclusions"],
    "src/shared/i18n/locales/*.ts",
  );
  assert.equal(
    properties["sonar.javascript.lcov.reportPaths"],
    "coverage/unit/lcov.info,coverage/governance/lcov.info",
  );
});
const evidenceFixture = async (context) => {
  const directory = await realpath(
    await mkdtemp(path.join(tmpdir(), "kernel-ci-evidence-")),
  );
  context.after(async () => {
    assert.equal(path.dirname(directory), await realpath(tmpdir()));
    assert.ok(path.basename(directory).startsWith("kernel-ci-evidence-"));
    await rm(directory, { recursive: true, force: true });
  });
  const expected = identity();
  const environment = {
    GITHUB_REPOSITORY: expected.repository,
    GITHUB_RUN_ID: expected.runId,
    GITHUB_RUN_ATTEMPT: expected.runAttempt,
    GITHUB_TOKEN: "synthetic-read-only-token",
    GITHUB_OUTPUT: path.join(directory, "output"),
    GITHUB_EVENT_PATH: path.join(directory, "event.json"),
    GITHUB_EVENT_NAME: "pull_request",
    VERIFICATION_HEAD: expected.head,
    VERIFICATION_BASE: expected.base,
    VERIFICATION_COMMIT: expected.commit,
    VERIFICATION_TREE: expected.tree,
    VERIFICATION_METADATA_ONLY: "true",
    VERIFICATION_APPLICATION: "false",
    SONAR_PROJECT_KEY: "synthetic-analysis",
  };
  const producer = {
    ...expected,
    commit: "e".repeat(40),
    runId: "122",
    runAttempt: "2",
  };
  const run = {
    id: 122,
    status: "completed",
    conclusion: "success",
    head_sha: expected.head,
    head_repository: { full_name: expected.repository },
    path: ".github/workflows/ci.yml",
    updated_at: "2026-10-31T01:00:00Z",
  };
  const artifact = { name: "verification-122-2", expired: false };
  const report = coverageManifest(producer, contents(), {
    applicationReady: false,
  });
  const put = async (file, data) => {
    const filename = path.join(directory, file);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, data);
  };
  await put(
    ".agents/validation.json",
    JSON.stringify({ applicationReady: false }),
  );
  await put(
    "event.json",
    JSON.stringify({
      action: "edited",
      changes: { title: { from: "before" } },
      pull_request: {
        head: { sha: expected.head },
        base: { sha: expected.base },
      },
    }),
  );
  for (const [file, data] of Object.entries(contents())) await put(file, data);
  await put("coverage/verification-coverage.json", JSON.stringify(report));
  const requests = [];
  const responses = new Map([
    [
      "actions/workflows/ci.yml/runs?head_sha=" +
        expected.head +
        "&per_page=20",
      { total_count: 1, workflow_runs: [run] },
    ],
    ["actions/runs/122/artifacts?per_page=100", { artifacts: [artifact] }],
    ["actions/runs/122", run],
  ]);
  const logs = [];
  const runner = (overrides = {}) =>
    createEvidenceRunner({
      directory,
      environment,
      readGit: (...args) => {
        if (args[0] === "diff") return "docs/validation.md\0";
        assert.equal(args[0], "rev-parse");
        return args[1] === "HEAD" ? expected.commit : expected.tree;
      },
      request: async (url, options) => {
        assert.equal(
          options.headers.Authorization,
          "Bearer synthetic-read-only-token",
        );
        const prefix =
          "https://api.github.com/repos/" + expected.repository + "/";
        assert.ok(url.startsWith(prefix));
        const route = url.slice(prefix.length);
        requests.push(route);
        assert.ok(
          responses.has(route),
          "Unexpected synthetic request: " + route,
        );
        return {
          ok: true,
          status: 200,
          json: async () => responses.get(route),
        };
      },
      now: () => new Date("2026-10-31T00:00:00Z"),
      logger: {
        log: (value) => logs.push(value),
        warn: (value) => logs.push(value),
      },
      ...overrides,
    });
  const outputs = async () =>
    Object.fromEntries(
      (await readFile(environment.GITHUB_OUTPUT, "utf8"))
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf("=");
          return [line.slice(0, separator), line.slice(separator + 1)];
        }),
    );
  const resetOutput = () => writeFile(environment.GITHUB_OUTPUT, "");
  const enableReuse = () =>
    Object.assign(environment, {
      VERIFICATION_REUSE_DOWNLOAD: "success",
      VERIFICATION_REUSE_ARTIFACT: artifact.name,
      VERIFICATION_REUSE_RUN_ID: producer.runId,
      VERIFICATION_REUSE_ATTEMPT: producer.runAttempt,
    });
  return {
    directory,
    environment,
    expected,
    producer,
    run,
    artifact,
    report,
    put,
    requests,
    responses,
    logs,
    runner,
    outputs,
    resetOutput,
    enableReuse,
  };
};

test("evidence orchestration records real scope and fresh measured bytes, then verifies that exact artifact", async (context) => {
  const fixture = await evidenceFixture(context);
  const execute = fixture.runner();
  await execute("--scope");
  assert.equal((await fixture.outputs()).run, "false");
  assert.equal((await fixture.outputs()).profile, "full");
  assert.equal((await fixture.outputs()).tree, fixture.expected.tree);
  await fixture.resetOutput();
  await execute("--performance-scope");
  assert.equal((await fixture.outputs()).advisory, "true");
  await fixture.resetOutput();
  await execute("--record-coverage");
  const recorded = JSON.parse(
    await readFile(
      path.join(fixture.directory, "coverage/verification-coverage.json"),
      "utf8",
    ),
  );
  assert.deepEqual(recorded.identity, fixture.expected);
  assert.deepEqual(
    recorded.files,
    coverageManifest(fixture.expected, contents()).files,
  );
  assert.deepEqual(await fixture.outputs(), {
    artifact: "verification-123-2",
    attempt: "2",
    run_id: "123",
  });
  await execute("--verify-coverage");
  assert.equal(fixture.requests.length, 0);
});

test("evidence orchestration preserves the original successful producer through reuse, publication and scanner verification", async (context) => {
  const fixture = await evidenceFixture(context);
  const execute = fixture.runner();
  await execute("--prepare-reuse");
  assert.deepEqual(await fixture.outputs(), {
    artifact: fixture.artifact.name,
    runId: "122",
    runAttempt: "2",
  });
  fixture.enableReuse();
  await fixture.resetOutput();
  await execute("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "true");
  fixture.environment.VERIFICATION_REUSED = "true";
  await fixture.resetOutput();
  await execute("--record-coverage");
  assert.deepEqual(await fixture.outputs(), {
    artifact: fixture.artifact.name,
    attempt: "2",
    run_id: "122",
  });
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(fixture.directory, "coverage/verification-coverage.json"),
        "utf8",
      ),
    ),
    fixture.report,
  );
  fixture.environment.VERIFICATION_COVERAGE_RUN_ID = "122";
  fixture.environment.VERIFICATION_COVERAGE_ATTEMPT = "2";
  await execute("--verify-coverage");
  assert.ok(
    fixture.logs.some((line) =>
      line.includes("no fresh test execution is claimed"),
    ),
  );
});

test("missing credentials and failed or unavailable API evidence never authorize reuse", async (context) => {
  const fixture = await evidenceFixture(context);
  const scenarios = [
    {
      setup: () => {
        delete fixture.environment.GITHUB_TOKEN;
      },
      overrides: {},
    },
    {
      setup: () => {
        fixture.environment.GITHUB_TOKEN = "synthetic-read-only-token";
      },
      overrides: { request: async () => ({ ok: false, status: 503 }) },
    },
    {
      setup: () => {},
      overrides: {
        request: async () => {
          throw new Error("synthetic network failure");
        },
      },
    },
    {
      setup: () => {
        fixture.run.conclusion = "failure";
      },
      overrides: {},
    },
    {
      setup: () => {
        fixture.run.conclusion = "success";
        fixture.responses.set("actions/runs/122/artifacts?per_page=100", {
          artifacts: [],
        });
      },
      overrides: {},
    },
  ];
  for (const scenario of scenarios) {
    scenario.setup();
    await fixture.resetOutput();
    await fixture.runner(scenario.overrides)("--prepare-reuse");
    assert.deepEqual(await fixture.outputs(), {});
  }
  assert.ok(
    fixture.logs.some((line) =>
      line.includes("fresh canonical checks will run"),
    ),
  );
  fixture.environment.VERIFICATION_METADATA_ONLY = "false";
  const count = fixture.requests.length;
  await fixture.runner()("--prepare-reuse");
  assert.equal(fixture.requests.length, count);
});

test("missing or corrupt downloaded evidence falls back to fresh checks instead of a reuse pass", async (context) => {
  const fixture = await evidenceFixture(context);
  const execute = fixture.runner();
  await execute("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "false");
  fixture.enableReuse();
  await fixture.put("coverage/verification-coverage.json", "not JSON");
  await execute("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "false");
  await fixture.put(
    "coverage/verification-coverage.json",
    JSON.stringify(fixture.report),
  );
  await fixture.put("coverage/unit/lcov.info", "tampered bytes");
  await execute("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "false");
  await fixture.put(
    "coverage/unit/lcov.info",
    contents()["coverage/unit/lcov.info"],
  );
  const mismatched = structuredClone(fixture.report);
  mismatched.verification.applicationReady = true;
  await fixture.put(
    "coverage/verification-coverage.json",
    JSON.stringify(mismatched),
  );
  await execute("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "false");
  assert.ok(
    fixture.logs.some((line) =>
      line.includes("did not match this source/base/tree"),
    ),
  );
});

test("fresh scanner and evidence publication fail closed on invalid identity, checkout, missing files or configuration", async (context) => {
  const fixture = await evidenceFixture(context);
  const execute = fixture.runner();
  const head = fixture.environment.VERIFICATION_HEAD;
  delete fixture.environment.VERIFICATION_HEAD;
  await assert.rejects(execute("--verify-coverage"), /Coverage identity/);
  fixture.environment.VERIFICATION_HEAD = head;
  await assert.rejects(
    fixture.runner({ readGit: () => "f".repeat(40) })("--verify-coverage"),
    /checked-out revision/,
  );
  await assert.rejects(
    fixture.runner({
      readGit: (_command, ref) =>
        ref === "HEAD" ? fixture.expected.commit : "f".repeat(40),
    })("--verify-coverage"),
    /checked-out revision/,
  );
  await execute("--record-coverage");
  delete fixture.environment.SONAR_PROJECT_KEY;
  await assert.rejects(
    execute("--verify-coverage"),
    /Configure SONAR_PROJECT_KEY/,
  );
  fixture.environment.SONAR_PROJECT_KEY = "synthetic-analysis";
  await rm(path.join(fixture.directory, "coverage/unit/lcov.info"));
  await assert.rejects(execute("--verify-coverage"), /ENOENT/);
  await mkdir(path.join(fixture.directory, "coverage/unit/lcov.info"));
  await assert.rejects(execute("--record-coverage"), /ordinary measured files/);
  await rm(path.join(fixture.directory, "coverage/unit/lcov.info"), {
    recursive: true,
  });
  await fixture.put(
    "coverage/unit/lcov.info",
    contents()["coverage/unit/lcov.info"],
  );
  await rm(path.join(fixture.directory, "coverage/verification-coverage.json"));
  await mkdir(
    path.join(fixture.directory, "coverage/verification-coverage.json"),
  );
  await assert.rejects(
    execute("--verify-coverage"),
    /provenance must be an ordinary artifact file/,
  );
});

test("application phase mismatch cannot reuse otherwise valid measured evidence", () => {
  const producer = { ...identity(), runId: "122" };
  const report = coverageManifest(producer, contents(), {
    applicationReady: false,
  });
  assert.throws(
    () =>
      verifyReusedCoverage(
        report,
        identity(),
        { artifact: "verification-122-2", runId: "122", runAttempt: "2" },
        {},
        contents(),
        { applicationReady: true },
      ),
    /different application phase/,
  );
});

test("incomplete or malformed API history cannot establish the latest successful verification", async (context) => {
  const fixture = await evidenceFixture(context);
  const route =
    "actions/workflows/ci.yml/runs?head_sha=" +
    fixture.expected.head +
    "&per_page=20";
  for (const history of [
    { total_count: 21, workflow_runs: [fixture.run] },
    { workflow_runs: [fixture.run] },
    { total_count: 0 },
  ]) {
    fixture.responses.set(route, history);
    await fixture.resetOutput();
    await fixture.runner()("--prepare-reuse");
    assert.deepEqual(await fixture.outputs(), {});
  }
  assert.deepEqual(fixture.requests, [route, route, route]);
});

test("download acceptance rechecks actual producer success, source identity and current performance expiry", async (context) => {
  const fixture = await evidenceFixture(context);
  fixture.enableReuse();
  fixture.run.conclusion = "failure";
  await fixture.runner()("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "false");
  fixture.run.conclusion = "success";
  const stale = structuredClone(fixture.report);
  stale.identity.base = fixture.expected.head;
  await fixture.put(
    "coverage/verification-coverage.json",
    JSON.stringify(stale),
  );
  await fixture.runner()("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "false");
  await fixture.put(
    ".agents/validation.json",
    JSON.stringify({ applicationReady: true }),
  );
  const advisory = coverageManifest(fixture.producer, contents(), {
    applicationReady: true,
    performanceAdvisory: true,
    performanceOutcome: "failure",
  });
  await fixture.put(
    "coverage/verification-coverage.json",
    JSON.stringify(advisory),
  );
  await fixture.runner({ now: () => new Date("2026-11-06T23:59:59Z") })(
    "--accept-reuse",
  );
  assert.equal((await fixture.outputs()).reused, "true");
  await fixture.runner({ now: () => new Date(lighthouseException.expiresAt) })(
    "--accept-reuse",
  );
  assert.equal((await fixture.outputs()).reused, "false");
});
