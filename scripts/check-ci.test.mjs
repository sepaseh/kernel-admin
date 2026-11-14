import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { parse, stringify } from "yaml";

import {
  ciOwner,
  coverageManifest,
  createEvidenceRunner,
  inspectCi,
  inspectCodeqlWorkflow,
  inspectSonarWorkflow,
  lighthouseException,
  requiredCheckCommands,
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
const workflow = () => parse(read("scripts/ci-single-pass.test.yml"));
const applicationWorkflow = () => read(".github/workflows/ci.yml");
const historicalApplicationWorkflow = () =>
  read("scripts/ci-application-single-pass.test.yml");
const actualManifest = () => JSON.parse(read(".agents/validation.json"));
const install = "npm ci --strict-peer-deps --no-audit --no-fund";
const analysisInstall =
  "npm ci --strict-peer-deps --ignore-scripts --no-audit --no-fund";
const phaseManifest = (phase, count) => {
  const value = actualManifest();
  value.verificationModel = "single-pass-v1";
  for (const check of value.checks)
    if (check.ciJobs.length) check.ciJobs = ["check"];
  value.phase = phase;
  value.applicationReady = phase === "application-verification";
  const required = new Set(
    value.profiles.full
      .filter((id) => value.applicationReady || id !== "actions-lint")
      .slice(0, count),
  );
  value.checks = value.checks.filter(
    (check) => check.kind !== "required" || required.has(check.id),
  );
  value.profiles.full = [...required];
  return value;
};
const manifest = () => phaseManifest("release-prerequisites", 12);
const phaseWorkflow = () => stringify(workflow());
const changedWorkflow = (change) => {
  const value = workflow();
  change(value);
  return stringify(value);
};
const command = (value, text, name = "check") =>
  value.jobs[name].steps.find((step) => step.run === text);
const canonical = "npm run validate -- ${{ needs.scope.outputs.profile }}";
const browsers = "npm run ${{ needs.scope.outputs.browser_install }}";

const splitWorkflow = () => parse(read("scripts/ci-split-suites.test.yml"));
const splitManifest = () => {
  const value = actualManifest();
  value.phase = "release-prerequisites";
  value.applicationReady = false;
  value.verificationModel = "split-suites-v1";
  const full = value.profiles.full.slice(
    0,
    value.profiles.full.indexOf("storybook-browser") + 1,
  );
  value.checks = value.checks.filter(({ id }) => full.includes(id));
  const owners = {
    audit: "audit",
    "unit-coverage": "unit",
    "governance-coverage": "governance",
  };
  for (const check of value.checks) {
    check.ciJobs = [owners[check.id] ?? "quality"];
    check.scopes = [value.phase];
  }
  value.profiles = { full, complete: [...full] };
  for (const job of ["quality", "audit", "unit", "governance"]) {
    value.profiles["ci-" + job] = full.filter(
      (id) => (owners[id] ?? "quality") === job,
    );
  }
  return value;
};

test("split CI retains the 13-check gate through release prerequisites", () => {
  const workflow = stringify(splitWorkflow());
  for (const phase of ["storybook-verification", "release-prerequisites"]) {
    const selected = splitManifest();
    selected.phase = phase;
    for (const check of selected.checks) check.scopes = [phase];
    assert.deepEqual(inspectCi(workflow, selected), { requiredChecks: 13 });
    assert.deepEqual(inspectSonarWorkflow(workflow, selected), {
      requiredChecks: 13,
    });
  }
  assert.deepEqual(Object.keys(splitWorkflow().jobs), [
    "quality",
    "audit",
    "unit",
    "governance",
    "check",
    "analysis",
  ]);
  const selected = splitManifest();
  const partitions = ["quality", "audit", "unit", "governance"].flatMap(
    (id) => selected.profiles["ci-" + id],
  );
  assert.equal(partitions.length, selected.profiles.full.length);
  assert.deepEqual(new Set(partitions), new Set(selected.profiles.full));
});

test("split CI retains the complete gate through the business screens phase", () => {
  for (const phase of [
    "repository-foundation",
    "runtime-localization",
    "http-lifecycle",
    "ui-foundation",
    "core-auth",
    "business-screens",
  ]) {
    const selected = splitManifest();
    selected.phase = phase;
    const coreOnly = (id) => !id.startsWith("storybook-");
    selected.checks = selected.checks.filter(({ id }) => coreOnly(id));
    for (const check of selected.checks) check.scopes = [phase];
    for (const profile of ["full", "complete", "ci-quality"]) {
      selected.profiles[profile] = selected.profiles[profile].filter(coreOnly);
    }
    const workflow = splitWorkflow();
    workflow.jobs.quality["timeout-minutes"] = 15;
    workflow.jobs.quality.steps = workflow.jobs.quality.steps.filter(
      (step) => step.run !== "npm run browser:install",
    );

    assert.deepEqual(inspectCi(stringify(workflow), selected), {
      requiredChecks: 11,
    });
    assert.deepEqual(inspectSonarWorkflow(stringify(workflow), selected), {
      requiredChecks: 11,
    });
  }
});

test("split CI rejects unknown, unadmitted and runnable application phases", () => {
  for (const [phase, applicationReady] of [
    ["unknown", false],
    ["governance", false],
    ["foundation", false],
    ["assistant-guidance", false],
    ["application-verification", true],
    ["repository-foundation", true],
    ["runtime-localization", true],
    ["http-lifecycle", true],
    ["ui-foundation", true],
    ["core-auth", true],
    ["business-screens", true],
    ["storybook-verification", true],
    ["release-prerequisites", true],
  ]) {
    const selected = { ...splitManifest(), phase, applicationReady };

    assert.throws(
      () => inspectCi(stringify(splitWorkflow()), selected),
      /owns only repository-foundation.*release-prerequisites/,
    );
    assert.throws(
      () => inspectSonarWorkflow(stringify(splitWorkflow()), selected),
      /owns only repository-foundation.*release-prerequisites/,
    );
  }
});

test("split suites cannot skip checks, duplicate execution, replace source or weaken coverage transport", () => {
  for (const change of [
    (value) => {
      value.jobs.unit.if = "false";
    },
    (value) => {
      value.jobs.governance["continue-on-error"] = true;
    },
    (value) => {
      value.jobs.quality.steps.at(-1).run = "npm run validate -- full";
    },
    (value) => {
      const steps = value.jobs.quality.steps;
      const install = steps.findIndex(
        (step) => step.run === "npm run browser:install",
      );
      assert.notEqual(install, -1);
      steps.splice(install, 1);
    },
    (value) => {
      value.jobs.audit.steps.push({ run: "npm run audit" });
    },
    (value) => {
      value.jobs.unit.steps[0].with.ref = "main";
    },
    (value) => {
      value.jobs.governance.steps[0].with["persist-credentials"] = true;
    },
    (value) => {
      value.jobs.unit.steps.at(-1).with["if-no-files-found"] = "warn";
    },
    (value) => {
      value.jobs.unit.steps.at(-1).with.overwrite = true;
    },
    (value) => {
      value.jobs.unit.steps.at(-2).env.CI_EVIDENCE_SUITE = "governance";
    },
    (value) => {
      value.jobs.unit.outputs.attempt = "1";
    },
    (value) => {
      value.jobs.quality.permissions = { contents: "write" };
    },
    (value) => {
      value.jobs.governance["timeout-minutes"] = 60;
    },
    (value) => {
      value.jobs.e2e = structuredClone(value.jobs.unit);
    },
    (value) => {
      value.on.pull_request.paths = ["scripts/**"];
    },
    (value) => {
      value.concurrency["cancel-in-progress"] = true;
    },
  ]) {
    const value = splitWorkflow();
    change(value);
    assert.throws(() => inspectCi(stringify(value), splitManifest()));
  }
  for (const change of [
    (value) => {
      value.profiles["ci-unit"] = [];
    },
    (value) => {
      value.profiles["ci-quality"].push("unit-coverage");
    },
    (value) => {
      value.checks.find((check) => check.id === "unit-coverage").ciJobs = [
        "check",
      ];
    },
  ]) {
    const value = splitManifest();
    change(value);
    assert.throws(
      () => inspectCi(stringify(splitWorkflow()), value),
      /partition|one CI owner/,
    );
  }
});

test("the required aggregate runs after failure and rejects unsuccessful or missing suite results", () => {
  const aggregate = splitWorkflow().jobs.check;
  assert.equal(aggregate.if, "always()");
  const commandText = aggregate.steps[0].run;
  const source = commandText.slice('node -e "'.length, -1);
  const successful = Object.fromEntries(
    aggregate.needs.map((id) => [id, { result: "success" }]),
  );
  const run = (needs) =>
    spawnSync(process.execPath, ["-e", source], {
      env: {
        CI_NEEDS: JSON.stringify(needs),
        SystemRoot: process.env.SystemRoot,
      },
      encoding: "utf8",
      windowsHide: true,
    });
  assert.equal(run(successful).status, 0);
  for (const id of aggregate.needs) {
    for (const result of ["failure", "cancelled", "skipped", undefined]) {
      const changed = structuredClone(successful);
      changed[id].result = result;
      assert.equal(run(changed).status, 1, id + ": " + result);
    }
    const changed = structuredClone(successful);
    delete changed[id];
    assert.equal(run(changed).status, 1);
  }
  for (const change of [
    (value) => {
      delete value.jobs.check.if;
    },
    (value) => {
      value.jobs.check.needs.pop();
    },
    (value) => {
      value.jobs.check.steps[0].run = 'node -e "process.exit(0)"';
    },
  ]) {
    const value = splitWorkflow();
    change(value);
    assert.throws(() => inspectCi(stringify(value), splitManifest()));
  }
});

test("Sonar consumes both successful suite artifacts and verifies each producing attempt before analysis", () => {
  for (const change of [
    (value) => {
      value.jobs.analysis.needs = ["unit", "governance"];
    },
    (value) => {
      value.jobs.analysis.if = "always()";
    },
    (value) => {
      value.jobs.analysis.steps[2].env.SONAR_TOKEN_CONFIGURED = "true";
    },
    (value) => {
      value.jobs.analysis.steps[3].with.name = "foreign-coverage";
    },
    (value) => {
      value.jobs.analysis.steps[3].with["digest-mismatch"] = "warn";
    },
    (value) => {
      value.jobs.analysis.steps[4].env.CI_EVIDENCE_PRODUCER_ATTEMPT = "1";
    },
    (value) => {
      value.jobs.analysis.steps[6].env.CI_EVIDENCE_SUITE = "unit";
    },
    (value) => {
      value.jobs.analysis.steps[6].env.CI_EVIDENCE_PRODUCER_ATTEMPT =
        "${{ needs.unit.outputs.attempt }}";
    },
    (value) => {
      value.jobs.analysis.steps.splice(4, 1);
    },
    (value) => {
      value.jobs.analysis.steps.push({ run: "npm run test:coverage" });
    },
    (value) => {
      value.jobs.analysis.steps.at(-1).env.SONAR_TOKEN = "literal-token";
    },
  ]) {
    const value = splitWorkflow();
    change(value);
    assert.throws(() => inspectCi(stringify(value), splitManifest()));
  }
});

test("CodeQL runs real security analysis on every PR base with minimal upload permission", () => {
  const content = read(".github/workflows/codeql.yml");
  assert.deepEqual(inspectCodeqlWorkflow(content), {
    requiredContext: "CodeQL",
  });
  const source = parse(content);
  for (const change of [
    (value) => {
      delete value.on.pull_request;
    },
    (value) => {
      value.on.pull_request = { branches: ["main"] };
    },
    (value) => {
      value.on.pull_request = { "paths-ignore": ["scripts/**"] };
    },
    (value) => {
      value.on.pull_request = { types: ["opened"] };
    },
    (value) => {
      value.on.pull_request_target = null;
    },
    (value) => {
      delete value.on.schedule;
    },
    (value) => {
      delete value.on.workflow_dispatch;
    },
    (value) => {
      value.permissions.contents = "write";
    },
    (value) => {
      value.jobs.analyze.if = "false";
    },
    (value) => {
      value.jobs.analyze["continue-on-error"] = true;
    },
    (value) => {
      value.jobs.analyze["timeout-minutes"] = 0;
    },
    (value) => {
      value.jobs.analyze.permissions.contents = "write";
    },
    (value) => {
      value.jobs.analyze.permissions["security-events"] = "read";
    },
    (value) => {
      value.jobs.analyze.steps[0].with["persist-credentials"] = true;
    },
    (value) => {
      value.jobs.analyze.steps[1].uses = "github/codeql-action/init@main";
    },
    (value) => {
      value.jobs.analyze.steps[1].with.queries = "default";
    },
    (value) => {
      value.jobs.analyze.steps[1].with.languages = "javascript-typescript";
    },
    (value) => {
      value.jobs.analyze.steps[1].with["build-mode"] = "none";
    },
    (value) => {
      value.jobs.analyze.steps[2].if = "false";
    },
    (value) => {
      value.jobs.analyze.steps[2]["continue-on-error"] = true;
    },
    (value) => {
      value.jobs.analyze.steps.push({ run: "npm install" });
    },
  ]) {
    const changed = structuredClone(source);
    change(changed);
    assert.throws(() => inspectCodeqlWorkflow(stringify(changed)));
  }
});

test("the active application workflow requires all 18 checks and verified coverage", () => {
  const workflow = applicationWorkflow();
  const selected = actualManifest();
  assert.equal(selected.applicationReady, true);
  assert.equal(parse(workflow).concurrency.queue, undefined);
  assert.deepEqual(inspectCi(workflow, selected), { requiredChecks: 18 });
  assert.deepEqual(inspectSonarWorkflow(workflow, selected), {
    requiredChecks: 18,
  });
});

test("application CI partitions each real check once while complete substitutes the browser matrix", () => {
  const selected = actualManifest();
  assert.equal(selected.verificationModel, "split-application-v1");
  const owners = [
    "quality",
    "audit",
    "unit",
    "governance",
    "storybook",
    "build",
    "contract",
    "e2e",
  ];
  const checks = owners.flatMap((id) => {
    const profile = selected.profiles["ci-" + id];
    assert.ok(profile.length > 0);
    assert.ok(profile.every((check) => ciOwner(selected, check) === id));
    return profile;
  });
  assert.equal(checks.length, 18);
  assert.deepEqual(new Set(checks), new Set(selected.profiles.full));
  assert.deepEqual(selected.profiles["ci-build"], [
    "typecheck",
    "application-build",
    "bundle",
  ]);
  assert.deepEqual(selected.profiles["ci-e2e-complete"], [
    "browser-compatibility",
  ]);
  for (const mutate of [
    (value) => value.profiles["ci-quality"].push("typecheck"),
    (value) => value.profiles["ci-build"].shift(),
    (value) => value.profiles["ci-e2e-complete"].push("application-e2e"),
    (value) => {
      value.checks.find(({ id }) => id === "unit-coverage").ciJobs = ["check"];
    },
  ]) {
    const changed = structuredClone(selected);
    mutate(changed);
    assert.throws(() => inspectCi(applicationWorkflow(), changed));
  }
});

test("application suites cannot skip, repeat or redirect actual source and build verification", () => {
  const changes = [
    (value) => {
      value.jobs.audit["continue-on-error"] = true;
    },
    (value) => {
      value.jobs.unit.if = "false";
    },
    (value) => {
      value.jobs.quality.steps.push({ run: "npm run test:coverage" });
    },
    (value) => {
      command(value, "npm run validate -- ci-storybook", "storybook").run =
        "npm run validate -- full";
    },
    (value) => {
      value.jobs.build.steps[0].with.ref = "main";
    },
    (value) => {
      value.jobs.contract.steps[0].with["persist-credentials"] = true;
    },
    (value) => {
      value.jobs.e2e.needs = ["scope"];
    },
    (value) => {
      value.jobs.e2e.env.KERNEL_REUSE_VERIFICATION_BUILD = "0";
    },
    (value) => {
      command(value, "npm run validate -- ci-e2e", "e2e").if = "true";
    },
    (value) => {
      command(value, "npm run validate -- ci-e2e-complete", "e2e").if =
        "needs.scope.outputs.profile == 'full'";
    },
    (value) => {
      value.jobs.visual.if = "true";
    },
    (value) => {
      value.jobs.e2e.steps.find((step) =>
        step.uses?.startsWith("actions/download-artifact@"),
      ).with.name = "mutable-build";
    },
    (value) => {
      value.jobs.visual.steps.find((step) =>
        step.uses?.startsWith("actions/download-artifact@"),
      ).with["digest-mismatch"] = "warn";
    },
    (value) => {
      command(
        value,
        "node scripts/ci-evidence.mjs --verify-build",
        "performance",
      ).env.CI_EVIDENCE_PRODUCER_ATTEMPT = "${{ github.run_attempt }}";
    },
    (value) => {
      const steps = value.jobs.e2e.steps;
      const install = steps.findIndex(
        (step) => step.run === "npm ci --strict-peer-deps --no-audit --no-fund",
      );
      steps.splice(2, 0, ...steps.splice(install, 1));
    },
    (value) => {
      value.jobs.build.steps.at(-1).with.path = "dist/";
    },
    (value) => {
      value.jobs.unit.outputs.attempt = "1";
    },
    (value) => {
      command(
        value,
        "node scripts/ci-evidence.mjs --record",
        "unit",
      ).env.CI_EVIDENCE_SUITE = "governance";
    },
    (value) => {
      value.jobs.governance.steps.at(-1).with.path =
        "coverage/governance/lcov.info\ncoverage/governance/ci-evidence.json\n";
    },
    (value) => {
      value.jobs.build.steps.at(-1).with.overwrite = true;
    },
    (value) => {
      value.jobs.check.if = "success()";
    },
    (value) => {
      value.jobs.check.steps[0].env.CI_VISUAL_REQUIRED = "false";
    },
    (value) => {
      value.jobs.check.permissions = { contents: "write" };
    },
  ];
  for (const [index, mutate] of changes.entries()) {
    const value = parse(applicationWorkflow());
    mutate(value);
    assert.throws(
      () => inspectCi(stringify(value), actualManifest()),
      "mutation " + index,
    );
  }
});

test("active application jobs check out the immutable event revision with no repository or credential override", () => {
  const source = parse(applicationWorkflow());
  const jobs = Object.entries(source.jobs).filter(
    ([id]) => !["scope", "check"].includes(id),
  );
  for (const [id, job] of jobs) {
    assert.equal(job.steps[0].with.ref, "${{ github.sha }}", id);
    for (const mutate of [
      (checkout) => {
        checkout.ref = "${{ needs.scope.outputs.commit }}";
      },
      (checkout) => {
        checkout.ref = "${{ github.event.pull_request.head.sha }}";
      },
      (checkout) => {
        checkout.ref = "main";
      },
      (checkout) => {
        delete checkout.ref;
      },
      (checkout) => {
        checkout.repository = "untrusted/other";
      },
      (checkout) => {
        checkout.path = "other";
      },
      (checkout) => {
        checkout["persist-credentials"] = true;
      },
    ]) {
      const changed = structuredClone(source);
      mutate(changed.jobs[id].steps[0].with);
      assert.throws(() => inspectCi(stringify(changed), actualManifest()), id);
      if (id === "analysis")
        assert.throws(() =>
          inspectSonarWorkflow(stringify(changed), actualManifest()),
        );
    }
  }
});

test("application aggregate rejects missing, failed, cancelled and unexpected skipped results", () => {
  const aggregate = parse(applicationWorkflow()).jobs.check;
  assert.equal(aggregate.if, "always()");
  const script = /^node -e "([\s\S]*)"$/.exec(
    aggregate.steps[0].run.trim(),
  )?.[1];
  assert.ok(script);
  const results = Object.fromEntries(
    aggregate.needs.map((id) => [id, { result: "success" }]),
  );
  const execute = (needs, visual) =>
    spawnSync(process.execPath, ["-e", script], {
      env: {
        ...process.env,
        CI_NEEDS: JSON.stringify(needs),
        CI_VISUAL_REQUIRED: visual,
      },
      encoding: "utf8",
      windowsHide: true,
    }).status;
  assert.equal(execute(results, "true"), 0);
  assert.equal(
    execute({ ...results, visual: { result: "skipped" } }, "false"),
    0,
  );
  for (const id of aggregate.needs) {
    for (const result of ["failure", "cancelled", "skipped", "pending"]) {
      assert.notEqual(
        execute({ ...results, [id]: { result } }, "true"),
        0,
        id + ":" + result,
      );
    }
    const missing = structuredClone(results);
    delete missing[id];
    assert.notEqual(execute(missing, "true"), 0, "missing " + id);
  }
  for (const visual of ["", "unknown", "false"])
    assert.notEqual(execute(results, visual), 0);
});

test("application analysis verifies each actual suite attempt without retesting or substituting PowerShell evidence", () => {
  for (const mutate of [
    (value) => {
      value.jobs.analysis.needs = ["scope", "check", "unit"];
    },
    (value) => {
      value.jobs.analysis.steps.find(
        (step) => step.env?.CI_EVIDENCE_SUITE === "unit",
      ).env.CI_EVIDENCE_PRODUCER_ATTEMPT =
        "${{ needs.governance.outputs.attempt }}";
    },
    (value) => {
      value.jobs.analysis.steps.find(
        (step) => step.with?.path === "coverage/governance",
      ).with.name = "${{ needs.unit.outputs.artifact }}";
    },
    (value) => {
      value.jobs.analysis.steps.find((step) => step.id === "governance").id =
        "unverified";
    },
    (value) => {
      value.jobs.analysis.steps.at(-1).with.args =
        "-Dsonar.coverageReportPaths=coverage/forged.xml";
    },
    (value) => {
      value.jobs.analysis.steps.push({ run: "npm run test:coverage" });
    },
  ]) {
    const value = parse(applicationWorkflow());
    mutate(value);
    assert.throws(() =>
      inspectSonarWorkflow(stringify(value), actualManifest()),
    );
  }
});

test("independent Lighthouse execution retains the fresh bounded exception and actual outcome", () => {
  for (const mutate of [
    (value) => {
      value.jobs.performance["continue-on-error"] = true;
    },
    (value) => {
      command(
        value,
        "node scripts/check-ci.mjs --performance-scope",
        "performance",
      ).if = "false";
    },
    (value) => {
      command(value, "npm run validate -- performance", "performance")[
        "continue-on-error"
      ] = true;
    },
    (value) => {
      command(value, "npm run validate -- performance", "performance")[
        "continue-on-error"
      ] = "${{ needs.scope.outputs.advisory == 'true' }}";
    },
    (value) => {
      value.jobs.performance.steps.find(
        (step) => step.env?.PERFORMANCE_OUTCOME,
      ).env.PERFORMANCE_OUTCOME = "success";
    },
  ]) {
    const value = parse(applicationWorkflow());
    mutate(value);
    assert.throws(() => inspectCi(stringify(value), actualManifest()));
  }
});

test("historical application CI runs fresh checks for metadata edits and rejects reuse or skipped commands", () => {
  for (const change of [
    (value) => {
      value.jobs.check.steps.push({
        run: "node scripts/check-ci.mjs --prepare-reuse",
      });
    },
    (value) => {
      command(value, canonical).if = "needs.scope.outputs.run == 'true'";
    },
    (value) => {
      command(
        value,
        "node scripts/check-ci.mjs --record-coverage",
      ).env.VERIFICATION_REUSED = "${{ steps.reuse.outputs.reused }}";
    },
  ]) {
    const value = parse(historicalApplicationWorkflow());
    change(value);
    assert.throws(
      () =>
        inspectCi(
          stringify(value),
          phaseManifest("application-verification", 18),
        ),
      /fresh verification|declared condition|actual application phase/,
    );
  }
});

test("the historical single-pass fixture runs core verification once and reuses measured coverage for one scanner", () => {
  assert.deepEqual(
    inspectCi(read("scripts/ci-single-pass.test.yml"), manifest()),
    {
      requiredChecks: manifest().profiles.full.length,
    },
  );
  assert.deepEqual(
    inspectSonarWorkflow(read("scripts/ci-single-pass.test.yml"), manifest()),
    { requiredChecks: manifest().profiles.full.length },
  );
  assert.deepEqual(Object.keys(workflow().jobs).sort(), [
    "analysis",
    "check",
    "scope",
  ]);
});

test("analysis requires credentials and project binding before consuming coverage", () => {
  const configured = (value) =>
    value.jobs.analysis.steps.find(
      (step) => step.name === "Require configured SonarQube Cloud analysis",
    );
  for (const change of [
    (value) => {
      delete configured(value).env.SONAR_TOKEN_CONFIGURED;
    },
    (value) => {
      configured(value).env.SONAR_TOKEN_CONFIGURED = "true";
    },
    (value) => {
      delete configured(value).env.SONAR_PROJECT_KEY;
    },
    (value) => {
      configured(value).run = "Write-Output 'Analysis configured'";
    },
    (value) => {
      const steps = value.jobs.analysis.steps;
      const index = steps.indexOf(configured(value));
      steps.push(...steps.splice(index, 1));
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /configured credentials|exactly once|existing measured coverage/,
    );
});

test("every declared publication phase retains its exact available verification capabilities", () => {
  for (const [phase, count] of [
    ["governance", 10],
    ["repository-foundation", 10],
    ["foundation", 10],
    ["catalogs", 10],
    ["runtime-localization", 10],
    ["http-lifecycle", 10],
    ["ui-foundation", 10],
    ["core-auth", 10],
    ["business-screens", 10],
    ["storybook-verification", 12],
    ["assistant-guidance", 12],
    ["release-prerequisites", 12],
    ["application-verification", 18],
  ]) {
    const value = phaseManifest(phase, count);
    const source = value.applicationReady
      ? historicalApplicationWorkflow()
      : phaseWorkflow();
    for (const inspect of [inspectCi, inspectSonarWorkflow]) {
      assert.deepEqual(inspect(source, value), {
        requiredChecks: count,
      });
      for (const id of value.profiles.full) {
        const missing = structuredClone(value);
        missing.checks = missing.checks.filter((check) => check.id !== id);
        missing.profiles.full = missing.profiles.full.filter(
          (check) => check !== id,
        );
        assert.throws(
          () => inspect(source, missing),
          /every exact required core check/,
        );
      }
    }
  }
});

test("unknown phases and contradictory readiness cannot select a smaller verification gate", () => {
  for (const [phase, ready] of [
    ["unknown-phase", false],
    ["repository-foundation", true],
    ["application-verification", false],
    ["repository-foundation", undefined],
  ]) {
    const value = phaseManifest(phase, 10);
    value.applicationReady = ready;
    for (const inspect of [inspectCi, inspectSonarWorkflow])
      assert.throws(
        () => inspect(phaseWorkflow(), value),
        /phase and application readiness/,
      );
    delete value.verificationModel;
    for (const inspect of [inspectCi, inspectSonarWorkflow])
      assert.throws(
        () => inspect(phaseWorkflow(), value),
        /phase and application readiness/,
      );
  }
});

test("phase check selection does not expose mutable policy definitions", () => {
  const value = phaseManifest("repository-foundation", 10);
  const checks = requiredCheckCommands(value);
  checks[0][1] = "npm run pretend";
  checks.pop();

  assert.equal(requiredCheckCommands(value).length, 10);
  assert.deepEqual(requiredCheckCommands(value)[0], [
    "snapshot",
    "npm run check:snapshot",
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
  for (const text of [install, browsers, canonical]) {
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
  for (const text of [install, browsers]) {
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
  for (const text of [install, browsers, canonical]) {
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
        step.with.repository = "example/backend";
      },
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
    const value = actualManifest();
    change(value);
    assert.throws(
      () => inspectCi(applicationWorkflow(), value),
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
    assert.equal(scope({ event, runMetadataEdits: true }).run, "true");
    assert.equal(scope({ event, runMetadataEdits: true }).visual, "true");
    assert.equal(
      scope({ event, runMetadataEdits: true, files: ["docs/testing.md"] })
        .visual,
      "false",
    );
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
const currentRun = () => ({
  id: 123,
  run_number: 23,
  workflow_id: 45,
  status: "in_progress",
  conclusion: null,
  head_sha: head,
  head_repository: { full_name: identity().repository },
  path: ".github/workflows/ci.yml",
});
const powershellFile = "coverage/governance/powershell.xml";
const contents = (applicationReady = false) => ({
  "coverage/unit/lcov.info": Buffer.from(
    "SF:src/value.ts\nDA:1,1\nend_of_record\n",
  ),
  "coverage/governance/lcov.info": Buffer.from(
    "SF:scripts/check.mjs\nDA:1,1\nend_of_record\n",
  ),
  ...(applicationReady
    ? {
        [powershellFile]: Buffer.from(
          '<coverage version="1"><file path="scripts/stop-visual-process-tree.ps1"><lineToCover lineNumber="12" covered="true"/><lineToCover lineNumber="18" covered="false"/></file></coverage>\n',
        ),
      }
    : {}),
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

test("application coverage binds genuine-format PowerShell hits and misses alongside both LCOV reports", () => {
  const measured = contents(true);
  const report = coverageManifest(identity(), measured, {
    applicationReady: true,
  });
  assert.equal(report.files.length, 3);
  assert.equal(report.files[2].path, powershellFile);
  assert.equal(
    verifyCoverageManifest(report, identity(), measured, {
      applicationReady: true,
    }),
    true,
  );
  const declared = measured[powershellFile].toString();
  assert.doesNotThrow(() =>
    coverageManifest(
      identity(),
      {
        ...measured,
        [powershellFile]: Buffer.from(
          '<?xml version="1.0" encoding="utf-8"?>\n' +
            declared.replace('covered="false"', 'covered="true"'),
        ),
      },
      { applicationReady: true },
    ),
  );
  for (const value of [
    undefined,
    "not XML",
    declared.replace("stop-visual-process-tree.ps1", "other.ps1"),
    declared.replace('version="1"', 'version="2"'),
    declared.replaceAll('covered="true"', 'covered="false"'),
    declared.replace('lineNumber="18"', 'lineNumber="12"'),
    declared.replace('lineNumber="18"', 'lineNumber="0"'),
    declared.replace('lineNumber="18"', 'lineNumber="9007199254740992"'),
    declared.replace('covered="false"', 'covered="unknown"'),
    declared.replace("</file>", "<unexpected/></file>"),
  ]) {
    const changed = { ...measured };
    if (value === undefined) delete changed[powershellFile];
    else changed[powershellFile] = Buffer.from(value);
    assert.throws(
      () => coverageManifest(identity(), changed, { applicationReady: true }),
      /PowerShell/,
    );
  }
  const changed = {
    ...measured,
    [powershellFile]: Buffer.from(
      declared.replace('covered="false"', 'covered="true"'),
    ),
  };
  assert.throws(
    () => verifyCoverageManifest(report, identity(), changed),
    /exact tested source/,
  );
  assert.throws(
    () =>
      verifyCoverageManifest(
        coverageManifest(identity(), contents()),
        identity(),
        contents(),
        { applicationReady: true },
      ),
    /PowerShell/,
  );
});

test("metadata reuse accepts an actual successful producer with exact source/base/tree and original measured bytes", () => {
  const expected = identity();
  const run = {
    id: 122,
    run_number: 22,
    workflow_id: 45,
    status: "completed",
    conclusion: "success",
    head_sha: head,
    head_repository: { full_name: expected.repository },
    path: ".github/workflows/ci.yml",
    updated_at: "2026-10-31T01:00:00Z",
  };
  const artifact = { name: "verification-122-2", expired: false };
  const candidate = reusableCoverageCandidate(
    [run],
    [artifact],
    expected,
    currentRun(),
  );
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
    verifyReusedCoverage(report, expected, candidate, run, contents(), {
      currentRun: currentRun(),
    }),
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
      () =>
        verifyReusedCoverage(value, expected, candidate, run, contents(), {
          currentRun: currentRun(),
        }),
      /exact tested source/,
    );
  }
});

test("metadata edits cannot turn a latest failed, pending, canceled or missing verification into a pass", () => {
  const passed = {
    id: 121,
    run_number: 21,
    workflow_id: 45,
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
      run_number: 22,
      updated_at: "2026-10-31T02:00:00Z",
    };
    assert.equal(
      reusableCoverageCandidate(
        [passed, latest],
        [artifact],
        identity(),
        currentRun(),
      ),
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
          { currentRun: currentRun() },
        ),
      /successful CI producer/,
    );
  }
  assert.equal(
    reusableCoverageCandidate([], [], identity(), currentRun()),
    undefined,
  );
  assert.equal(
    reusableCoverageCandidate(
      [passed],
      [{ ...artifact, expired: true }],
      identity(),
      currentRun(),
    ),
    undefined,
  );
  assert.equal(
    reusableCoverageCandidate(
      [{ ...passed, head_sha: base }],
      [artifact],
      identity(),
      currentRun(),
    ),
    undefined,
  );
  assert.equal(
    reusableCoverageCandidate(
      [{ ...passed, head_repository: { full_name: "other/project" } }],
      [artifact],
      identity(),
      currentRun(),
    ),
    undefined,
  );
});

test("repeated metadata reuse selects the newest unexpired artifact from successful matching producers", () => {
  const producer = {
    id: 120,
    run_number: 20,
    workflow_id: 45,
    status: "completed",
    conclusion: "success",
    head_sha: head,
    head_repository: { full_name: identity().repository },
    path: ".github/workflows/ci.yml",
    updated_at: "2026-10-31T01:00:00Z",
  };
  const latest = {
    ...producer,
    id: 122,
    run_number: 22,
    updated_at: "2026-10-31T03:00:00Z",
  };
  const failed = {
    ...producer,
    id: 121,
    run_number: 21,
    conclusion: "failure",
    updated_at: "2026-10-31T02:00:00Z",
  };
  const artifact = {
    name: "verification-120-2",
    expired: false,
    created_at: "2026-10-31T01:00:00Z",
  };
  const runs = [producer, latest, failed];
  const artifacts = [
    {
      ...artifact,
      name: "verification-120-1",
      created_at: "2026-10-31T00:00:00Z",
    },
    { ...artifact, name: "verification-121-1" },
    { ...artifact, name: "verification-122-1", expired: true },
    artifact,
    {
      ...artifact,
      name: "verification-120-3",
      expired: true,
      created_at: "2026-10-31T02:00:00Z",
    },
  ];

  assert.deepEqual(
    reusableCoverageCandidate(runs, artifacts, identity(), currentRun()),
    {
      artifact: artifact.name,
      runId: "120",
      runAttempt: "2",
    },
  );
  for (const change of [
    { status: "in_progress", conclusion: null },
    { status: "completed", conclusion: "cancelled" },
    { status: "completed", conclusion: "failure" },
  ]) {
    assert.equal(
      reusableCoverageCandidate(
        [producer, { ...latest, ...change }, failed],
        artifacts,
        identity(),
        currentRun(),
      ),
      undefined,
    );
  }
});

test("application metadata cannot reuse an advisory performance failure after expiry while the prerequisite phase gains no performance gate", () => {
  const expected = identity();
  const run = {
    id: 122,
    run_number: 22,
    workflow_id: 45,
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
    contents(true),
    {
      applicationReady: true,
      performanceAdvisory: true,
      performanceOutcome: "failure",
      recordedAt: "2026-11-06T23:00:00Z",
    },
  );
  assert.doesNotThrow(() =>
    verifyReusedCoverage(report, expected, candidate, run, contents(true), {
      currentRun: currentRun(),
      applicationReady: true,
      now: "2026-11-06T23:59:59Z",
    }),
  );
  assert.throws(
    () =>
      verifyReusedCoverage(report, expected, candidate, run, contents(true), {
        currentRun: currentRun(),
        applicationReady: true,
        now: lighthouseException.expiresAt,
      }),
    /exception expired/,
  );
  const blocking = structuredClone(report);
  blocking.verification.performanceAdvisory = false;
  blocking.verification.performanceOutcome = "success";
  assert.doesNotThrow(() =>
    verifyReusedCoverage(blocking, expected, candidate, run, contents(true), {
      currentRun: currentRun(),
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
      currentRun: currentRun(),
      applicationReady: false,
      now: "2026-11-08T00:00:00Z",
    }),
  );
});

test("Sonar installs locked analysis types once without package scripts or repeated test execution", () => {
  for (const change of [
    (value) => {
      command(value, analysisInstall, "analysis").run = "npm ci";
    },
    (value) => {
      command(value, analysisInstall, "analysis").run =
        "npm ci --ignore-scripts || true";
    },
    (value) => {
      command(value, analysisInstall, "analysis")["continue-on-error"] = true;
    },
    (value) => {
      value.jobs.analysis.steps.push({ run: analysisInstall });
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
      value.concurrency.group =
        "ci-${{ github.ref }}-${{ github.event.action }}";
    },
    (value) => {
      value.concurrency["cancel-in-progress"] = true;
    },
    (value) => {
      value.concurrency.queue = "max";
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
  const fixture = phaseManifest("assistant-guidance", 12);
  assert.deepEqual(inspectCi(phaseWorkflow(), fixture), {
    requiredChecks: 12,
  });
  assert.deepEqual(
    inspectSonarWorkflow(read("scripts/ci-single-pass.test.yml"), fixture),
    { requiredChecks: 12 },
  );
  for (const phase of [
    manifest(),
    fixture,
    phaseManifest("repository-foundation", 10),
  ]) {
    for (const change of [
      (workflow) => {
        delete command(
          workflow,
          "node scripts/check-ci.mjs --verify-coverage",
          "analysis",
        ).id;
      },
      ...[
        "",
        powershellFile,
        "${{ needs.scope.outputs.application }}",
        "${{ steps.other.outputs.powershell_report }}",
      ].map((reportPath) => (workflow) => {
        const scanner = workflow.jobs.analysis.steps.find((step) =>
          step.uses?.startsWith("SonarSource/"),
        );
        scanner.with.args = scanner.with.args.replace(
          "${{ steps.coverage.outputs.powershell_report }}",
          reportPath,
        );
      }),
    ])
      assert.throws(
        () => inspectSonarWorkflow(changedWorkflow(change), phase),
        /verified coverage|verified phase report paths/,
      );
  }
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

test("Sonar preserves source, fixture and coverage scope with duplication measurement disabled", () => {
  const properties = Object.fromEntries(
    read("sonar-project.properties")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  const application = actualManifest().applicationReady === true;
  const published = JSON.parse(
    read(".github/bootstrap-policy.json"),
  ).allowedFiles;
  const admitted = (root) =>
    published.some((file) => file === root || file.startsWith(root + "/"));
  assert.deepEqual(
    properties["sonar.sources"].split(","),
    [
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
    ].filter(admitted),
  );
  assert.deepEqual(
    properties["sonar.tests"].split(","),
    [
      "src",
      "scripts",
      ".storybook",
      ...(application ? ["e2e", "contract"] : []),
    ].filter(admitted),
  );
  const fixtures = [
    ...(admitted("src")
      ? ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"]
      : []),
    "scripts/*.test.mjs",
    "scripts/*.test.ps1",
    "scripts/*.test-support.mjs",
    ...(admitted("src") ? ["src/**/*.stories.tsx"] : []),
    ...(admitted(".storybook") ? [".storybook/**"] : []),
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
  assert.equal(properties["sonar.cpd.exclusions"], "**/*");
  assert.equal(
    properties["sonar.javascript.lcov.reportPaths"],
    "coverage/unit/lcov.info,coverage/governance/lcov.info",
  );
  assert.equal(
    properties["sonar.coverageReportPaths"],
    application ? powershellFile : undefined,
  );
});
const evidenceFixture = async (context, { applicationReady = false } = {}) => {
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
    GITHUB_RUN_NUMBER: "23",
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
    VERIFICATION_APPLICATION: String(applicationReady),
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
    run_number: 22,
    workflow_id: 45,
    status: "completed",
    conclusion: "success",
    head_sha: expected.head,
    head_repository: { full_name: expected.repository },
    path: ".github/workflows/ci.yml",
    updated_at: "2026-10-31T01:00:00Z",
  };
  const artifact = { name: "verification-122-2", expired: false };
  const report = coverageManifest(producer, contents(applicationReady), {
    applicationReady,
  });
  const put = async (file, data) => {
    const filename = path.join(directory, file);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, data);
  };
  await put(".agents/validation.json", JSON.stringify({ applicationReady }));
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
  for (const [file, data] of Object.entries(contents(applicationReady)))
    await put(file, data);
  await put("coverage/verification-coverage.json", JSON.stringify(report));
  const requests = [];
  const responses = new Map([
    ["actions/runs/123", currentRun()],
    [
      "actions/workflows/ci.yml/runs?head_sha=" +
        expected.head +
        "&per_page=100",
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
  assert.equal((await fixture.outputs()).powershell_report, "");
  assert.equal(fixture.requests.length, 0);
});

test("non-application scanner input disables unverified extra PowerShell XML instead of importing it", async (context) => {
  const fixture = await evidenceFixture(context);
  const execute = fixture.runner();
  await fixture.put(powershellFile, "unverified extra XML");
  await execute("--record-coverage");
  await fixture.resetOutput();
  await execute("--verify-coverage");
  assert.deepEqual(await fixture.outputs(), { powershell_report: "" });
  await fixture.put(powershellFile, contents(true)[powershellFile]);
  await fixture.resetOutput();
  await execute("--verify-coverage");
  assert.deepEqual(await fixture.outputs(), { powershell_report: "" });
  fixture.enableReuse();
  fixture.environment.VERIFICATION_COVERAGE_RUN_ID = fixture.producer.runId;
  fixture.environment.VERIFICATION_COVERAGE_ATTEMPT =
    fixture.producer.runAttempt;
  await fixture.put(
    "coverage/verification-coverage.json",
    JSON.stringify(fixture.report),
  );
  await fixture.resetOutput();
  await execute("--verify-coverage");
  assert.deepEqual(await fixture.outputs(), { powershell_report: "" });
});

test("application publication and scanner bind measured PowerShell bytes while reuse rejects tampering and missing reports", async (context) => {
  const fixture = await evidenceFixture(context, { applicationReady: true });
  const execute = fixture.runner();
  await execute("--record-coverage");
  await execute("--verify-coverage");
  assert.equal((await fixture.outputs()).powershell_report, powershellFile);
  const recorded = JSON.parse(
    await readFile(
      path.join(fixture.directory, "coverage/verification-coverage.json"),
      "utf8",
    ),
  );
  assert.equal(recorded.verification.applicationReady, true);
  assert.deepEqual(
    recorded.files,
    coverageManifest(fixture.expected, contents(true), {
      applicationReady: true,
    }).files,
  );
  fixture.enableReuse();
  await fixture.put(
    "coverage/verification-coverage.json",
    JSON.stringify(fixture.report),
  );
  await execute("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "true");
  const measuredPowershell = contents(true)[powershellFile];
  const altered = measuredPowershell
    .toString()
    .replace('covered="false"', 'covered="true"');
  await fixture.put(powershellFile, altered);
  await execute("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "false");
  fixture.environment.VERIFICATION_COVERAGE_RUN_ID = fixture.producer.runId;
  fixture.environment.VERIFICATION_COVERAGE_ATTEMPT =
    fixture.producer.runAttempt;
  await fixture.resetOutput();
  await assert.rejects(execute("--verify-coverage"), /exact tested source/);
  assert.deepEqual(await fixture.outputs(), {});
  await rm(path.join(fixture.directory, powershellFile));
  await execute("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "false");
  await assert.rejects(execute("--verify-coverage"), /ENOENT/);
  await assert.rejects(execute("--record-coverage"), /ENOENT/);
  await fixture.put(powershellFile, contents(true)[powershellFile]);
  const oldReport = coverageManifest(fixture.producer, contents());
  oldReport.verification.applicationReady = true;
  await fixture.put(
    "coverage/verification-coverage.json",
    JSON.stringify(oldReport),
  );
  await execute("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "false");
  await assert.rejects(execute("--verify-coverage"), /exact tested source/);
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

test("two successive metadata edits reuse the original measured producer without republishing its artifact", async (context) => {
  const fixture = await evidenceFixture(context);
  const historyRoute =
    "actions/workflows/ci.yml/runs?head_sha=" +
    fixture.expected.head +
    "&per_page=100";
  const history = [fixture.run];

  for (const runId of ["123", "124"]) {
    fixture.environment.GITHUB_RUN_ID = runId;
    fixture.environment.GITHUB_RUN_NUMBER = String(Number(runId) - 100);
    fixture.responses.set(`actions/runs/${runId}`, {
      ...currentRun(),
      id: Number(runId),
      run_number: Number(runId) - 100,
    });
    fixture.responses.set(historyRoute, {
      total_count: history.length,
      workflow_runs: [...history],
    });
    const execute = fixture.runner();
    await fixture.resetOutput();
    await execute("--prepare-reuse");
    assert.deepEqual(await fixture.outputs(), {
      artifact: fixture.artifact.name,
      runId: fixture.producer.runId,
      runAttempt: fixture.producer.runAttempt,
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
      attempt: fixture.producer.runAttempt,
      run_id: fixture.producer.runId,
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
    history.push({
      ...fixture.run,
      id: Number(runId),
      run_number: Number(runId) - 100,
      updated_at: "2026-10-31T02:00:00Z",
    });
    fixture.responses.set(`actions/runs/${runId}/artifacts?per_page=100`, {
      artifacts: [],
    });
  }
  assert.deepEqual(fixture.requests, [
    "actions/runs/123",
    historyRoute,
    "actions/runs/122/artifacts?per_page=100",
    "actions/runs/122",
    "actions/runs/123",
    "actions/runs/122",
    "actions/runs/123",
    "actions/runs/124",
    historyRoute,
    "actions/runs/123/artifacts?per_page=100",
    "actions/runs/122/artifacts?per_page=100",
    "actions/runs/122",
    "actions/runs/124",
    "actions/runs/122",
    "actions/runs/124",
  ]);
});

test("queued metadata can reuse its completed source producer while a later metadata event remains pending", async (context) => {
  const fixture = await evidenceFixture(context);
  const historyRoute =
    "actions/workflows/ci.yml/runs?head_sha=" +
    fixture.expected.head +
    "&per_page=100";
  const future = {
    ...currentRun(),
    id: 124,
    run_number: 24,
    status: "pending",
  };
  const olderFailure = {
    ...fixture.run,
    id: 121,
    run_number: 21,
    conclusion: "failure",
    updated_at: "2026-11-01T00:00:00Z",
  };
  fixture.responses.set(historyRoute, {
    total_count: 4,
    workflow_runs: [future, currentRun(), olderFailure, fixture.run],
  });
  fixture.run.status = "in_progress";
  fixture.run.conclusion = null;
  await fixture.resetOutput();
  await fixture.runner()("--prepare-reuse");
  assert.deepEqual(await fixture.outputs(), {});
  assert.deepEqual(fixture.requests, ["actions/runs/123", historyRoute]);

  fixture.run.status = "completed";
  fixture.run.conclusion = "success";
  const original = await readFile(
    path.join(fixture.directory, "coverage/verification-coverage.json"),
  );
  await fixture.resetOutput();
  await fixture.runner()("--prepare-reuse");
  assert.deepEqual(await fixture.outputs(), {
    artifact: fixture.artifact.name,
    runId: fixture.producer.runId,
    runAttempt: fixture.producer.runAttempt,
  });
  fixture.enableReuse();
  await fixture.runner()("--accept-reuse");
  assert.equal((await fixture.outputs()).reused, "true");
  fixture.environment.VERIFICATION_REUSED = "true";
  await fixture.resetOutput();
  await fixture.runner()("--record-coverage");
  assert.deepEqual(await fixture.outputs(), {
    artifact: fixture.artifact.name,
    attempt: fixture.producer.runAttempt,
    run_id: fixture.producer.runId,
  });
  assert.deepEqual(
    await readFile(
      path.join(fixture.directory, "coverage/verification-coverage.json"),
    ),
    original,
  );
  assert.equal(future.status, "pending");
});

test("reuse requires GitHub's current workflow identity and trustworthy predecessor run numbers", async (context) => {
  const fixture = await evidenceFixture(context);
  fixture.enableReuse();
  for (const current of [
    { ...currentRun(), id: 124 },
    { ...currentRun(), run_number: 24 },
    { ...currentRun(), run_number: undefined },
    { ...currentRun(), workflow_id: 46 },
    { ...currentRun(), workflow_id: undefined },
    { ...currentRun(), head_sha: base },
    { ...currentRun(), head_repository: { full_name: "other/project" } },
    { ...currentRun(), path: ".github/workflows/other.yml" },
  ]) {
    fixture.responses.set("actions/runs/123", current);
    await fixture.resetOutput();
    await fixture.runner()("--prepare-reuse");
    assert.deepEqual(await fixture.outputs(), {});
    await fixture.runner()("--accept-reuse");
    assert.equal((await fixture.outputs()).reused, "false");
  }
  fixture.responses.set("actions/runs/123", currentRun());
  for (const number of [undefined, "", "0", "23x", "24"]) {
    fixture.environment.GITHUB_RUN_NUMBER = number;
    await fixture.resetOutput();
    await fixture.runner()("--prepare-reuse");
    assert.deepEqual(await fixture.outputs(), {});
    await fixture.runner()("--accept-reuse");
    assert.equal((await fixture.outputs()).reused, "false");
  }
  fixture.environment.GITHUB_RUN_NUMBER = "23";
  for (const number of [
    undefined,
    "22",
    0,
    23,
    24,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    fixture.run.run_number = number;
    await fixture.resetOutput();
    await fixture.runner()("--prepare-reuse");
    assert.deepEqual(await fixture.outputs(), {});
    await fixture.runner()("--accept-reuse");
    assert.equal((await fixture.outputs()).reused, "false");
  }
});

test("older failed or incomplete runs never provide artifacts and the newest unsuccessful run blocks all reuse", async (context) => {
  const fixture = await evidenceFixture(context);
  fixture.run.run_number = 20;
  const historyRoute =
    "actions/workflows/ci.yml/runs?head_sha=" +
    fixture.expected.head +
    "&per_page=100";
  const latest = {
    ...fixture.run,
    id: 121,
    run_number: 22,
    updated_at: "2026-10-31T04:00:00Z",
  };
  const failed = {
    ...fixture.run,
    id: 120,
    run_number: 19,
    conclusion: "failure",
    updated_at: "2026-10-31T03:00:00Z",
  };
  const pending = {
    ...fixture.run,
    id: 119,
    run_number: 18,
    status: "in_progress",
    conclusion: null,
    updated_at: "2026-10-31T02:00:00Z",
  };
  fixture.responses.set(historyRoute, {
    total_count: 4,
    workflow_runs: [fixture.run, pending, latest, failed],
  });
  fixture.responses.set("actions/runs/121/artifacts?per_page=100", {
    artifacts: [{ name: "verification-121-1", expired: true }],
  });
  await fixture.runner()("--prepare-reuse");
  assert.equal((await fixture.outputs()).runId, fixture.producer.runId);
  assert.deepEqual(fixture.requests, [
    "actions/runs/123",
    historyRoute,
    "actions/runs/121/artifacts?per_page=100",
    "actions/runs/122/artifacts?per_page=100",
  ]);

  for (const change of [
    { status: "completed", conclusion: "failure" },
    { status: "completed", conclusion: "cancelled" },
    { status: "in_progress", conclusion: null },
  ]) {
    Object.assign(latest, change);
    await fixture.resetOutput();
    const count = fixture.requests.length;
    await fixture.runner()("--prepare-reuse");
    assert.deepEqual(await fixture.outputs(), {});
    assert.deepEqual(fixture.requests.slice(count), [
      "actions/runs/123",
      historyRoute,
    ]);
  }
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

test("coverage verification reads the validated descriptor after a pathname replacement", async (context) => {
  for (const file of [
    "coverage/unit/lcov.info",
    "coverage/verification-coverage.json",
  ]) {
    const fixture = await evidenceFixture(context);
    await fixture.runner()("--record-coverage");
    const target = path.join(fixture.directory, file);
    let replaced = false;
    let closed = false;
    const execute = fixture.runner({
      openFile: async (filename, flags) => {
        const handle = await open(filename, flags);
        if (filename !== target) return handle;

        return {
          stat: () => handle.stat(),
          readFile: async () => {
            await rename(filename, `${filename}.previous`);
            await writeFile(filename, "untrusted replacement");
            replaced = true;
            return handle.readFile();
          },
          close: async () => {
            closed = true;
            await handle.close();
          },
        };
      },
    });

    await execute("--verify-coverage");
    assert.equal(replaced, true, file);
    assert.equal(closed, true, file);
    assert.equal(await readFile(target, "utf8"), "untrusted replacement");
  }
});

test("coverage verification rejects a replacement before pathname validation and closes the handle", async (context) => {
  for (const file of [
    "coverage/unit/lcov.info",
    "coverage/verification-coverage.json",
  ]) {
    const fixture = await evidenceFixture(context);
    await fixture.runner()("--record-coverage");
    const target = path.join(fixture.directory, file);
    let read = false;
    let closed = false;
    const execute = fixture.runner({
      openFile: async (filename, flags) => {
        const handle = await open(filename, flags);
        if (filename !== target) return handle;

        return {
          stat: async () => {
            const info = await handle.stat();
            await rename(filename, `${filename}.previous`);
            await writeFile(filename, "untrusted replacement");
            return info;
          },
          readFile: async () => {
            read = true;
            return handle.readFile();
          },
          close: async () => {
            closed = true;
            await handle.close();
          },
        };
      },
    });

    await assert.rejects(execute("--verify-coverage"), /ordinary/);
    assert.equal(read, false, file);
    assert.equal(closed, true, file);
  }
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

test("pending events coalesce separately by event, ref and manual profile while active verification remains owned", () => {
  const value = workflow();
  assert.deepEqual(value.concurrency, {
    group:
      "ci-${{ github.event_name }}-${{ github.ref }}-${{ github.event.inputs.verification || 'default' }}",
    "cancel-in-progress": false,
    queue: "single",
  });
  for (const group of [
    "ci-${{ github.ref }}",
    "ci-${{ github.event_name }}-${{ github.ref }}",
  ]) {
    value.concurrency.group = group;
    assert.throws(
      () => inspectCi(stringify(value), manifest()),
      /coalesced event\/ref\/profile/,
    );
  }
});

test("each CI stage retains its declared execution budget and cannot expand token permissions", () => {
  assert.deepEqual(workflow().permissions, {
    contents: "read",
    actions: "read",
  });
  for (const [name, budget] of Object.entries({
    scope: 5,
    check: 45,
    analysis: 15,
  })) {
    assert.equal(workflow().jobs[name]["timeout-minutes"], budget);
    for (const timeout of [undefined, 0, budget + 1]) {
      const value = workflow();
      value.jobs[name]["timeout-minutes"] = timeout;
      assert.throws(
        () => inspectCi(stringify(value), manifest()),
        /blocking Windows/,
      );
    }
    const value = workflow();
    value.jobs[name].permissions = { contents: "write" };
    assert.throws(
      () => inspectCi(stringify(value), manifest()),
      /blocking Windows/,
    );
  }
  const privileged = workflow();
  privileged.permissions["pull-requests"] = "read";
  assert.throws(
    () => inspectCi(stringify(privileged), manifest()),
    /read-only evidence/,
  );
});

test("mandatory coverage and best-effort diagnostics have separate immutable artifacts", () => {
  const value = workflow();
  const coverage = value.jobs.check.steps.find(
    (step) => step.id === "coverage-upload",
  );
  const diagnostics = value.jobs.check.steps.find(
    (step) => step.id === "diagnostics-upload",
  );
  assert.equal(
    coverage.if,
    "success() && steps.reuse.outputs.reused != 'true'",
  );
  assert.equal(coverage.with["if-no-files-found"], "error");
  assert.deepEqual(coverage.with.path.trim().split("\n"), [
    "coverage/unit/lcov.info",
    "coverage/governance/lcov.info",
    "coverage/governance/powershell.xml",
    "coverage/verification-coverage.json",
  ]);
  assert.equal(
    diagnostics.if,
    "always() && steps.reuse.outputs.reused != 'true'",
  );
  assert.equal(
    diagnostics.with.name,
    "diagnostics-${{ github.run_id }}-${{ github.run_attempt }}",
  );
  assert.deepEqual(diagnostics.with.path.trim().split("\n"), [
    "coverage/e2e/",
    "coverage/visual/",
    "coverage/lighthouse/",
  ]);
  for (const change of [
    (v) => {
      v.jobs.check.steps.find((step) => step.id === "coverage-upload").if =
        "always()";
    },
    (v) => {
      v.jobs.check.steps.find((step) => step.id === "coverage-upload").with[
        "if-no-files-found"
      ] = "warn";
    },
    (v) => {
      v.jobs.check.steps.find(
        (step) => step.id === "coverage-upload",
      ).with.path += "coverage/e2e/\n";
    },
    (v) => {
      v.jobs.check.steps.find(
        (step) => step.id === "diagnostics-upload",
      ).with.name = coverage.with.name;
    },
    (v) => {
      v.jobs.check.steps.find((step) => step.id === "diagnostics-upload").if =
        "success()";
    },
    (v) => {
      v.jobs.check.steps.find((step) => step.id === "diagnostics-upload").with[
        "include-hidden-files"
      ] = true;
    },
    (v) => {
      v.jobs.check.steps.push({
        ...structuredClone(diagnostics),
        id: "extra-upload",
      });
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /declared condition|coverage must be recorded/,
    );
});

test("both coverage downloads require the verified digest policy and analysis keeps the npm cache", () => {
  for (const owner of ["check", "analysis"]) {
    for (const change of [
      (step) => {
        step.with["digest-mismatch"] = "warn";
      },
      (step) => {
        delete step.with["digest-mismatch"];
      },
      (step) => {
        step.uses =
          "actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0";
      },
    ]) {
      const value = workflow();
      const step = value.jobs[owner].steps.find((item) =>
        item.uses?.startsWith("actions/download-artifact@"),
      );
      assert.equal(step.with["digest-mismatch"], "error");
      change(step);
      assert.throws(
        () => inspectCi(stringify(value), manifest()),
        /Metadata reuse|existing measured coverage/,
      );
    }
  }
  const value = workflow();
  const setup = value.jobs.analysis.steps.find((step) =>
    step.uses?.startsWith("actions/setup-node@"),
  );
  assert.equal(setup.with.cache, "npm");
  delete setup.with.cache;
  assert.throws(
    () => inspectCi(stringify(value), manifest()),
    /existing measured coverage/,
  );
});

const extendedHistoryFixture = async (context) => {
  const fixture = await evidenceFixture(context);
  fixture.environment.GITHUB_RUN_NUMBER = "200";
  fixture.responses.set("actions/runs/123", {
    ...currentRun(),
    run_number: 200,
  });
  fixture.run.run_number = 1;
  const history = Array.from({ length: 100 }, (_, index) => ({
    ...fixture.run,
    id: 1000 + index,
    run_number: 101 - index,
  }));
  history.push(fixture.run);
  const route =
    "actions/workflows/ci.yml/runs?head_sha=" +
    fixture.expected.head +
    "&per_page=100";
  fixture.responses.set(route, {
    total_count: history.length,
    workflow_runs: history.slice(0, 100),
  });
  fixture.responses.set(route + "&page=2", {
    total_count: history.length,
    workflow_runs: history.slice(100),
  });
  for (const run of history.slice(0, 100))
    fixture.responses.set(`actions/runs/${run.id}/artifacts?per_page=100`, {
      artifacts: [],
    });
  return { fixture, history, route };
};

test("complete pagination finds the original measured producer beyond the first hundred runs", async (context) => {
  const { fixture, route } = await extendedHistoryFixture(context);
  await fixture.runner()("--prepare-reuse");
  assert.deepEqual(await fixture.outputs(), {
    artifact: fixture.artifact.name,
    runId: fixture.producer.runId,
    runAttempt: fixture.producer.runAttempt,
  });
  assert.deepEqual(fixture.requests.slice(0, 3), [
    "actions/runs/123",
    route,
    route + "&page=2",
  ]);
});

test("missing, duplicate or inconsistent later history pages never authorize reuse", async (context) => {
  const { fixture, history, route } = await extendedHistoryFixture(context);
  for (const page of [
    { total_count: 101, workflow_runs: [] },
    { total_count: 102, workflow_runs: [fixture.run] },
    { total_count: 101, workflow_runs: [history[0]] },
    { total_count: 101, workflow_runs: [{ ...fixture.run, id: undefined }] },
  ]) {
    fixture.responses.set(route + "&page=2", page);
    await fixture.resetOutput();
    const before = fixture.requests.length;
    await fixture.runner()("--prepare-reuse");
    assert.deepEqual(await fixture.outputs(), {});
    assert.deepEqual(fixture.requests.slice(before), [
      "actions/runs/123",
      route,
      route + "&page=2",
    ]);
  }
});

test("a second-page API failure falls back to fresh checks", async (context) => {
  const { fixture, route } = await extendedHistoryFixture(context);
  await fixture.resetOutput();
  await fixture.runner({
    request: async (url) => {
      const current = url.split(fixture.expected.repository + "/")[1];
      fixture.requests.push(current);
      if (current === route + "&page=2") return { ok: false, status: 503 };
      return { ok: true, json: async () => fixture.responses.get(current) };
    },
  })("--prepare-reuse");
  assert.deepEqual(await fixture.outputs(), {});
  assert.ok(
    fixture.logs.some((message) =>
      message.includes("fresh canonical checks will run"),
    ),
  );
  assert.deepEqual(fixture.requests, [
    "actions/runs/123",
    route,
    route + "&page=2",
  ]);
});

test("a newer failed or pending run on a later page blocks every older successful producer", async (context) => {
  const { fixture, history, route } = await extendedHistoryFixture(context);
  const latest = { ...fixture.run, id: 999, run_number: 199 };
  fixture.responses.set(route, {
    total_count: 102,
    workflow_runs: history.slice(0, 100),
  });
  for (const state of [
    { status: "completed", conclusion: "failure" },
    { status: "completed", conclusion: "cancelled" },
    { status: "in_progress", conclusion: null },
  ]) {
    Object.assign(latest, state);
    fixture.responses.set(route + "&page=2", {
      total_count: 102,
      workflow_runs: [fixture.run, latest],
    });
    await fixture.resetOutput();
    const before = fixture.requests.length;
    await fixture.runner()("--prepare-reuse");
    assert.deepEqual(await fixture.outputs(), {});
    assert.deepEqual(fixture.requests.slice(before), [
      "actions/runs/123",
      route,
      route + "&page=2",
    ]);
  }
});

test("incomplete or malformed API history cannot establish the latest successful verification", async (context) => {
  const fixture = await evidenceFixture(context);
  const route =
    "actions/workflows/ci.yml/runs?head_sha=" +
    fixture.expected.head +
    "&per_page=100";
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
  assert.deepEqual(fixture.requests, [
    "actions/runs/123",
    route,
    "actions/runs/123",
    route,
    "actions/runs/123",
    route,
  ]);
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
  await fixture.put(powershellFile, contents(true)[powershellFile]);
  const advisory = coverageManifest(fixture.producer, contents(true), {
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
