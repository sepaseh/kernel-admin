import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parse, stringify } from "yaml";

import { inspectCi } from "./check-ci.mjs";

const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const workflow = () => parse(read(".github/workflows/ci.yml"));
const manifest = () => JSON.parse(read(".agents/validation.json"));
const changedWorkflow = (change) => {
  const value = workflow();
  change(value);
  return stringify(value);
};
const fullStep = (value) =>
  value.jobs.check.steps.find(
    (step) => step.run === "npm run validate -- full",
  );
const installStep = (value) =>
  value.jobs.check.steps.find((step) => step.run === "npm ci");

test("the actual CI runs the complete canonical published profile", () => {
  const declared = manifest();
  assert.deepEqual(inspectCi(read(".github/workflows/ci.yml"), declared), {
    requiredChecks: declared.profiles.full.length,
  });
});

test("CI rejects missing PR triggers and path, branch or lifecycle filtering", () => {
  for (const change of [
    (value) => {
      delete value.on.pull_request;
    },
    ...["paths", "paths-ignore", "branches", "branches-ignore"].map(
      (key) => (value) => {
        value.on.pull_request[key] = ["src/**"];
      },
    ),
    (value) => {
      value.on.pull_request.types = ["opened", "synchronize"];
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /pull_request|filters|lifecycle/,
    );
});

test("CI permits unconditional PR trigger forms and additional lifecycle events", () => {
  for (const trigger of [
    "pull_request",
    ["pull_request", "push"],
    { pull_request: null },
  ]) {
    const value = workflow();
    value.on = trigger;
    assert.doesNotThrow(() => inspectCi(stringify(value), manifest()));
  }
});

test("CI rejects missing, dependent, conditional or advisory check jobs", () => {
  for (const change of [
    (value) => {
      delete value.jobs.check;
    },
    (value) => {
      value.jobs.check.if = "!github.event.pull_request.draft";
    },
    (value) => {
      value.jobs.check.needs = "changes";
    },
    (value) => {
      value.jobs.check.strategy = { matrix: { node: [] } };
    },
    (value) => {
      value.jobs.check["continue-on-error"] = true;
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /check job/,
    );
});

test("CI rejects omitted, repeated, altered or failure-ignoring full commands", () => {
  for (const change of [
    (value) => {
      value.jobs.check.steps = value.jobs.check.steps.filter(
        (step) => step !== fullStep(value),
      );
    },
    (value) => {
      value.jobs.check.steps.push({ run: "npm run validate -- full" });
    },
    (value) => {
      fullStep(value).run = "npm run validate -- focused";
    },
    (value) => {
      fullStep(value).run += " || true";
    },
    (value) => {
      fullStep(value).if = "always()";
    },
    (value) => {
      fullStep(value)["continue-on-error"] = true;
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /canonical full command|unconditional/,
    );
});

test("CI rejects omitted, repeated, conditional or late installation", () => {
  for (const change of [
    (value) => {
      value.jobs.check.steps = value.jobs.check.steps.filter(
        (step) => step !== installStep(value),
      );
    },
    (value) => {
      value.jobs.check.steps.unshift({ run: "npm ci" });
    },
    (value) => {
      installStep(value).if = "github.event_name == 'push'";
    },
    (value) => {
      installStep(value)["continue-on-error"] = true;
    },
    (value) => {
      const install = installStep(value);
      value.jobs.check.steps = value.jobs.check.steps.filter(
        (step) => step !== install,
      );
      value.jobs.check.steps.push(install);
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /exactly once|unconditional|before full/,
    );
});

test("CI rejects non-root execution and shell overrides at workflow, job or command scope", () => {
  for (const change of [
    (value) => {
      value.defaults = { run: { "working-directory": "other" } };
    },
    (value) => {
      value.jobs.check.defaults = { run: { "working-directory": "other" } };
    },
    (value) => {
      fullStep(value)["working-directory"] = "other";
    },
    (value) => {
      installStep(value)["working-directory"] = "other";
    },
    (value) => {
      value.defaults = { run: { shell: "echo {0}" } };
    },
    (value) => {
      value.jobs.check.defaults = { run: { shell: "echo {0}" } };
    },
    (value) => {
      fullStep(value).shell = "echo {0}";
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /repository root|default shell/,
    );
});

test("CI preserves permitted PR-size and artifact conditions without allowing validation skips", () => {
  const value = workflow();
  value.jobs.check.steps.push({
    if: "always()",
    uses: "actions/upload-artifact@synthetic",
    with: { path: "coverage" },
  });
  assert.doesNotThrow(() => inspectCi(stringify(value), manifest()));
});

test("CI rejects duplicate YAML keys and malformed workflow documents", () => {
  for (const content of [
    "jobs:\n  check: {}\n  check: {}\n",
    "jobs: [",
    "- not-a-workflow",
  ])
    assert.throws(
      () => inspectCi(content, manifest()),
      /valid YAML|workflow mapping/,
    );
});

test("CI refuses future multi-job checks until the execution policy is deliberately extended", () => {
  for (const jobs of [["visual"], ["check", "visual"], []]) {
    const value = manifest();
    value.checks[0].ciJobs = jobs;
    assert.throws(
      () => inspectCi(read(".github/workflows/ci.yml"), value),
      /policy transition/,
    );
  }
});
