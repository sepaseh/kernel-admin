import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { parse, stringify } from "yaml";

import { inspectCi, inspectSonarWorkflow } from "./check-ci.mjs";

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
const browserStep = (value) =>
  value.jobs.check.steps.find((step) => step.run === "npm run browser:install");

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

test("CI requires unconditional blocking browser installation exactly once between npm ci and full", () => {
  for (const change of [
    (value) => {
      value.jobs.check.steps = value.jobs.check.steps.filter(
        (step) => step !== browserStep(value),
      );
    },
    (value) => {
      value.jobs.check.steps.push({ run: "npm run browser:install" });
    },
    (value) => {
      value.jobs.check.steps.push({
        run: "npm run browser:install\necho duplicate",
      });
    },
    (value) => {
      browserStep(value).run += " || true";
    },
    (value) => {
      browserStep(value).if = "always()";
    },
    (value) => {
      browserStep(value)["continue-on-error"] = true;
    },
    (value) => {
      browserStep(value).shell = "echo {0}";
    },
    (value) => {
      browserStep(value)["working-directory"] = "other";
    },
    (value) => {
      browserStep(value).uses = "synthetic/action@pin";
    },
    (value) => {
      const browser = browserStep(value);
      value.jobs.check.steps = value.jobs.check.steps.filter(
        (step) => step !== browser,
      );
      value.jobs.check.steps.unshift(browser);
    },
    (value) => {
      const browser = browserStep(value);
      value.jobs.check.steps = value.jobs.check.steps.filter(
        (step) => step !== browser,
      );
      value.jobs.check.steps.push(browser);
    },
  ])
    assert.throws(
      () => inspectCi(changedWorkflow(change), manifest()),
      /exactly once|unconditional|default shell|repository root|before full/,
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

const sonarWorkflow = () => parse(read(".github/workflows/sonar.yml"));
const changedSonarWorkflow = (change) => {
  const value = sonarWorkflow();
  change(value);
  return stringify(value);
};
const sonarCommandStep = (value, command) =>
  value.jobs.analysis.steps.find((step) => step.run === command);
const scannerStep = (value) =>
  value.jobs.analysis.steps.find((step) =>
    step.uses?.startsWith("SonarSource/sonarqube-scan-action@"),
  );

test("the actual Sonar workflow validates the complete canonical profile before scanning", () => {
  assert.deepEqual(
    inspectSonarWorkflow(read(".github/workflows/sonar.yml"), manifest()),
    { requiredChecks: manifest().profiles.full.length },
  );
});

test("Sonar retains the legitimate same-repository fork condition without permitting arbitrary job skips", () => {
  const actual = sonarWorkflow();
  assert.doesNotThrow(() =>
    inspectSonarWorkflow(stringify(actual), manifest()),
  );
  actual.jobs.analysis.if = `\${{ ${actual.jobs.analysis.if} }}`;
  assert.doesNotThrow(() =>
    inspectSonarWorkflow(stringify(actual), manifest()),
  );
  delete actual.jobs.analysis.if;
  assert.doesNotThrow(() =>
    inspectSonarWorkflow(stringify(actual), manifest()),
  );
  for (const change of [
    (value) => {
      delete value.jobs.analysis;
    },
    (value) => {
      value.jobs.analysis.if = "false";
    },
    (value) => {
      value.jobs.analysis.if = "github.event_name == 'push'";
    },
    (value) => {
      value.jobs.analysis.needs = "changes";
    },
    (value) => {
      value.jobs.analysis.strategy = { matrix: { node: [] } };
    },
    (value) => {
      value.jobs.analysis["continue-on-error"] = true;
    },
  ])
    assert.throws(
      () => inspectSonarWorkflow(changedSonarWorkflow(change), manifest()),
      /analysis job|fork condition/,
    );
});

test("Sonar accepts complete expression wrappers with normalized whitespace", () => {
  const actual = sonarWorkflow();
  const condition = actual.jobs.analysis.if.replaceAll(" ", "\t\n ");
  for (const value of [condition, `  \${{\t${condition}\n}}  `]) {
    actual.jobs.analysis.if = value;
    assert.doesNotThrow(() =>
      inspectSonarWorkflow(stringify(actual), manifest()),
    );
  }
});

test("Sonar rejects incomplete wrappers, nested wrappers and long invalid conditions", () => {
  const actual = sonarWorkflow();
  const condition = actual.jobs.analysis.if;
  for (const value of [
    `\${{ ${condition}`,
    `${condition} }}`,
    `\${{ \${{ ${condition} }} }}`,
    `\${{ ${condition}${" ".repeat(20000)}false }}`,
  ]) {
    actual.jobs.analysis.if = value;
    assert.throws(
      () => inspectSonarWorkflow(stringify(actual), manifest()),
      /fork condition/,
    );
  }
});

test("Sonar requires each installation and full command exactly once, at root and without bypasses", () => {
  for (const command of [
    "npm ci",
    "npm run browser:install",
    "npm run validate -- full",
  ])
    for (const change of [
      (value) => {
        value.jobs.analysis.steps = value.jobs.analysis.steps.filter(
          (step) => step !== sonarCommandStep(value, command),
        );
      },
      (value) => {
        value.jobs.analysis.steps.push({ run: command });
      },
      (value) => {
        value.jobs.analysis.steps.push({ run: `${command}\necho duplicate` });
      },
      (value) => {
        sonarCommandStep(value, command).run += " || true";
      },
      (value) => {
        sonarCommandStep(value, command).if = "always()";
      },
      (value) => {
        sonarCommandStep(value, command)["continue-on-error"] = true;
      },
      (value) => {
        sonarCommandStep(value, command).shell = "echo {0}";
      },
      (value) => {
        sonarCommandStep(value, command)["working-directory"] = "other";
      },
    ])
      assert.throws(
        () => inspectSonarWorkflow(changedSonarWorkflow(change), manifest()),
        /exactly once|unconditional|default shell|repository root/,
      );
});

test("Sonar rejects reordered setup and a unit-only substitute for the full browser gate", () => {
  for (const change of [
    (value) => {
      const browser = sonarCommandStep(value, "npm run browser:install");
      value.jobs.analysis.steps = value.jobs.analysis.steps.filter(
        (step) => step !== browser,
      );
      value.jobs.analysis.steps.unshift(browser);
    },
    (value) => {
      const browser = sonarCommandStep(value, "npm run browser:install");
      value.jobs.analysis.steps = value.jobs.analysis.steps.filter(
        (step) => step !== browser,
      );
      value.jobs.analysis.steps.push(browser);
    },
    (value) => {
      sonarCommandStep(value, "npm run validate -- full").run =
        "npm run test:coverage\nnpm run test:governance";
    },
    (value) => {
      const scanner = scannerStep(value);
      value.jobs.analysis.steps = value.jobs.analysis.steps.filter(
        (step) => step !== scanner,
      );
      value.jobs.analysis.steps.unshift(scanner);
    },
  ])
    assert.throws(
      () => inspectSonarWorkflow(changedSonarWorkflow(change), manifest()),
      /before full|canonical full|after the canonical/,
    );
});

test("Sonar prerequisites and the scan remain blocking, root-scoped and unconditional within the permitted job", () => {
  for (const change of [
    (value) => {
      value.jobs.analysis.steps[2].if = "always()";
    },
    (value) => {
      value.jobs.analysis.steps[2]["continue-on-error"] = true;
    },
    (value) => {
      value.jobs.analysis.steps[2].shell = "echo {0}";
    },
    (value) => {
      value.jobs.analysis.steps[2]["working-directory"] = "other";
    },
    (value) => {
      value.defaults = { run: { shell: "echo {0}" } };
    },
    (value) => {
      value.jobs.analysis.defaults = { run: { "working-directory": "other" } };
    },
    (value) => {
      scannerStep(value).if = "always()";
    },
    (value) => {
      scannerStep(value)["continue-on-error"] = true;
    },
    (value) => {
      scannerStep(value).run = "echo skipped";
    },
    (value) => {
      const scanner = scannerStep(value);
      value.jobs.analysis.steps = value.jobs.analysis.steps.filter(
        (step) => step !== scanner,
      );
    },
    (value) => {
      value.jobs.analysis.steps.push({ ...scannerStep(value) });
    },
    (value) => {
      scannerStep(value).uses = "SonarSource/sonarqube-scan-action@latest";
    },
  ])
    assert.throws(
      () => inspectSonarWorkflow(changedSonarWorkflow(change), manifest()),
      /unconditional|blocking|repository root|default shell|scan exactly once/,
    );
});

test("Sonar classifies stories and preview tooling as analyzed tests without excluding production or weakening coverage and duplication", () => {
  const properties = Object.fromEntries(
    read("sonar-project.properties")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  assert.deepEqual(properties["sonar.sources"].split(","), [
    "src",
    "scripts",
    ".storybook",
  ]);
  assert.deepEqual(properties["sonar.tests"].split(","), [
    "src",
    "scripts",
    ".storybook",
  ]);
  const fixtures = [
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/test/**",
    "scripts/*.test.mjs",
    "src/**/*.stories.tsx",
    ".storybook/**",
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
