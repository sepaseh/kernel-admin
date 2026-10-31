import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parse, stringify } from "yaml";

import {
  coverageManifest,
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
