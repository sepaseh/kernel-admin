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

test("CI rejects undeclared job ownership in the current manifest", () => {
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
const invalidScannerRefs = [
  "latest",
  "v6",
  "",
  "a".repeat(39),
  "a".repeat(41),
  "g".repeat(40),
];

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

test("Sonar counts extra scanners with invalid pins before and after full validation", () => {
  for (const ref of invalidScannerRefs) {
    for (const beforeFull of [true, false]) {
      const content = changedSonarWorkflow((value) => {
        const fullIndex = value.jobs.analysis.steps.findIndex(
          (step) => step.run === "npm run validate -- full",
        );
        value.jobs.analysis.steps.splice(fullIndex + (beforeFull ? 0 : 1), 0, {
          uses: `SonarSource/sonarqube-scan-action@${ref}`,
        });
      });
      assert.throws(
        () => inspectSonarWorkflow(content, manifest()),
        /scan exactly once/,
      );
    }
  }
});

test("Sonar requires an exact immutable pin for its sole scanner", () => {
  for (const ref of invalidScannerRefs)
    assert.throws(
      () =>
        inspectSonarWorkflow(
          changedSonarWorkflow((value) => {
            scannerStep(value).uses =
              `SonarSource/sonarqube-scan-action@${ref}`;
          }),
          manifest(),
        ),
      /scan exactly once/,
    );
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

const prerequisiteManifest = () => {
  const value = manifest();
  value.phase = "assistant-guidance";
  value.applicationReady = false;
  value.checks = value.checks
    .filter((check) => check.scopes.includes("assistant-guidance"))
    .map((check) => ({ ...check, ciJobs: ["check"] }));
  value.profiles.full = value.checks
    .filter((check) => check.kind === "required")
    .map((check) => check.id);
  assert.equal(value.profiles.full.length, 12);
  return value;
};
const applicationManifest = () => {
  const value = prerequisiteManifest();
  value.phase = "application-verification";
  value.applicationReady = true;
  for (const [id, command, ciJobs] of [
    ["unused", "npm run check:unused", ["check"]],
    ["application-build", "npm run build", ["check", "build"]],
    ["bundle", "npm run check:bundle", ["check", "build"]],
    ["contract", "npm run test:contract", ["check"]],
    ["application-e2e", "npm run test:e2e", ["check", "e2e"]],
    ["visual", "npm run test:visual", ["check", "visual"]],
    ["lighthouse", "npm run test:lighthouse", ["check"]],
  ]) {
    value.checks.push({
      id,
      command,
      ciJobs,
      kind: "required",
      scopes: [value.phase],
    });
    value.profiles.full.push(id);
  }
  return value;
};
const prerequisiteCi = () => {
  const value = workflow();
  for (const name of ["build", "e2e", "visual"]) delete value.jobs[name];
  value.jobs.check["runs-on"] = "ubuntu-latest";
  return value;
};
const applicationCi = () => {
  const value = prerequisiteCi();
  value.jobs.check["runs-on"] = "windows-2025";
  const setup = value.jobs.check.steps.filter((step) => step.uses).slice(0, 2);
  for (const [name, browser, commands] of [
    ["build", false, ["npm run build", "npm run check:bundle"]],
    ["e2e", true, ["npm run test:e2e"]],
    ["visual", true, ["npm run test:visual"]],
  ])
    value.jobs[name] = {
      "runs-on": "windows-2025",
      steps: [
        ...structuredClone(setup),
        { run: "npm ci" },
        ...(browser ? [{ run: "npm run browser:install" }] : []),
        ...commands.map((run) => ({ run })),
      ],
    };
  return value;
};
const portableSonarGuard = [
  "node --input-type=module -e 'if (!process.env.SONAR_TOKEN ||",
  '!process.env.SONAR_PROJECT_KEY) { console.error("Configure SONAR_TOKEN',
  "and SONAR_PROJECT_KEY before analysis. No Sonar analysis was",
  "performed.\"); process.exit(1); }'",
].join(" ");
const sonarReadinessStep = (value) =>
  value.jobs.analysis.steps.find(
    (step) => step.env?.SONAR_PROJECT_KEY !== undefined && step.run,
  );
const applicationSonar = () => {
  const value = sonarWorkflow();
  value.jobs.analysis["runs-on"] = "windows-2025";
  sonarReadinessStep(value).run = portableSonarGuard;
  return value;
};

test("the twelve-check non-runnable phase remains independently valid on Linux", () => {
  const declared = prerequisiteManifest();
  assert.deepEqual(inspectCi(stringify(prerequisiteCi()), declared), {
    requiredChecks: 12,
  });
  const sonar = sonarWorkflow();
  sonar.jobs.analysis["runs-on"] = "ubuntu-latest";
  assert.deepEqual(inspectSonarWorkflow(stringify(sonar), declared), {
    requiredChecks: 12,
  });
  assert.throws(
    () => inspectCi(stringify(applicationCi()), declared),
    /phase policy transition/,
  );
});

test("the deliberate application phase runs nineteen full checks and actual native application jobs", () => {
  const declared = applicationManifest();
  assert.deepEqual(inspectCi(stringify(applicationCi()), declared), {
    requiredChecks: 19,
  });
  assert.deepEqual(
    inspectSonarWorkflow(stringify(applicationSonar()), declared),
    {
      requiredChecks: 19,
    },
  );
});

test("application Sonar requires its portable blocking readiness guard before full validation", () => {
  for (const change of [
    (value) => {
      sonarReadinessStep(value).run =
        'if [[ -z "$SONAR_TOKEN" ]]; then exit 1; fi';
    },
    (value) => {
      const guard = sonarReadinessStep(value);
      value.jobs.analysis.steps = value.jobs.analysis.steps.filter(
        (step) => step !== guard,
      );
    },
    (value) => {
      value.jobs.analysis.steps.unshift({ ...sonarReadinessStep(value) });
    },
    (value) => {
      const guard = sonarReadinessStep(value);
      value.jobs.analysis.steps = value.jobs.analysis.steps.filter(
        (step) => step !== guard,
      );
      value.jobs.analysis.steps.push(guard);
    },
    (value) => {
      sonarReadinessStep(value).run = portableSonarGuard.replace(
        "process.exit(1)",
        "process.exit(0)",
      );
    },
    (value) => {
      delete sonarReadinessStep(value).env.SONAR_TOKEN;
    },
    (value) => {
      sonarReadinessStep(value).env.SONAR_PROJECT_KEY = "invented-project";
    },
    (value) => {
      sonarReadinessStep(value)["continue-on-error"] = true;
    },
    (value) => {
      sonarReadinessStep(value).if = "always()";
    },
    (value) => {
      sonarReadinessStep(value).shell = "bash";
    },
    (value) => {
      sonarReadinessStep(value).uses = "actions/cache@synthetic";
    },
  ]) {
    const value = applicationSonar();
    change(value);
    assert.throws(
      () => inspectSonarWorkflow(stringify(value), applicationManifest()),
      /readiness guard|unconditional|default shell/,
    );
  }
});

test("application publication rejects an incomplete phase or invented check ownership", () => {
  for (const change of [
    (value) => {
      value.phase = "assistant-guidance";
    },
    (value) => {
      value.profiles.full.pop();
    },
    (value) => {
      value.profiles.full = value.profiles.full.map((id) =>
        id === "contract" ? "filler" : id,
      );
    },
    (value) => {
      value.checks.find((check) => check.id === "visual").kind = "advisory";
    },
    (value) => {
      value.checks.find((check) => check.id === "application-build").ciJobs = [
        "build",
      ];
    },
    (value) => {
      value.checks.find((check) => check.id === "visual").ciJobs = ["check"];
    },
    (value) => {
      value.checks.find((check) => check.id === "bundle").command =
        "npm run test:guidance";
    },
  ]) {
    const declared = applicationManifest();
    change(declared);
    assert.throws(
      () => inspectCi(stringify(applicationCi()), declared),
      /nineteen|phase|policy transition|actual canonical/,
    );
  }
});

test("application publication preserves all inherited checks and rejects filler, duplicates or altered commands", () => {
  for (const inherited of ["guidance", "audit", "boundaries"]) {
    const declared = applicationManifest();
    const original = declared.checks.find((check) => check.id === inherited);
    declared.checks = declared.checks.filter((check) => check.id !== inherited);
    declared.checks.push({ ...original, id: "filler" });
    declared.profiles.full = declared.profiles.full.map((id) =>
      id === inherited ? "filler" : id,
    );
    assert.throws(
      () => inspectCi(stringify(applicationCi()), declared),
      /nineteen exact required/,
    );
  }
  for (const change of [
    (value) => {
      value.checks.push({ ...value.checks[0] });
    },
    (value) => {
      value.profiles.full[2] = value.profiles.full[1];
    },
    (value) => {
      value.checks.push({
        id: "extra",
        kind: "required",
        command: "npm run lint",
        ciJobs: ["check"],
      });
    },
    (value) => {
      value.profiles.full.reverse();
    },
    ...["unused", "contract", "lighthouse", "guidance"].map((id) => (value) => {
      value.checks.find((check) => check.id === id).command = "npm run lint";
    }),
  ]) {
    const declared = applicationManifest();
    change(declared);
    assert.throws(
      () => inspectCi(stringify(applicationCi()), declared),
      /nineteen exact required/,
    );
  }
});

test("application jobs cannot skip, depend on filtered jobs, rename their status or use a mismatched platform", () => {
  for (const name of ["build", "e2e", "visual"])
    for (const change of [
      (value) => {
        delete value.jobs[name];
      },
      (value) => {
        value.jobs[name].name = "pretend-ready";
      },
      (value) => {
        value.jobs[name]["runs-on"] = "ubuntu-latest";
      },
      (value) => {
        value.jobs[name].if = "always()";
      },
      (value) => {
        value.jobs[name].needs = "changes";
      },
      (value) => {
        value.jobs[name].strategy = { matrix: { include: [] } };
      },
      (value) => {
        value.jobs[name]["continue-on-error"] = true;
      },
    ]) {
      const value = applicationCi();
      change(value);
      assert.throws(
        () => inspectCi(stringify(value), applicationManifest()),
        /independent blocking Windows/,
      );
    }
  const ci = applicationCi();
  ci.jobs.check["runs-on"] = "ubuntu-latest";
  assert.throws(
    () => inspectCi(stringify(ci), applicationManifest()),
    /Windows visual prerequisites/,
  );
  const sonar = sonarWorkflow();
  sonar.jobs.analysis["runs-on"] = "ubuntu-latest";
  assert.throws(
    () => inspectSonarWorkflow(stringify(sonar), applicationManifest()),
    /Windows visual prerequisites/,
  );
});

test("actual application commands and browser prerequisites cannot be replaced, hidden or reordered", () => {
  for (const name of ["build", "e2e", "visual"])
    for (const change of [
      (job) => {
        job.steps.pop();
      },
      (job) => {
        job.steps.push({ ...job.steps.at(-1) });
      },
      (job) => {
        job.steps.at(-1).run += " || true";
      },
      (job) => {
        job.steps.at(-1).if = "always()";
      },
      (job) => {
        job.steps.at(-1)["continue-on-error"] = true;
      },
      (job) => {
        job.steps.at(-1).shell = "echo {0}";
      },
      (job) => {
        job.steps.at(-1)["working-directory"] = "other";
      },
      (job) => {
        job.steps.push(
          job.steps.splice(
            job.steps.findIndex((step) => step.run === "npm ci"),
            1,
          )[0],
        );
      },
    ]) {
      const value = applicationCi();
      change(value.jobs[name]);
      assert.throws(
        () => inspectCi(stringify(value), applicationManifest()),
        /actual canonical|unconditional|default shell|repository root|must precede/,
      );
    }
  for (const name of ["e2e", "visual"]) {
    const value = applicationCi();
    value.jobs[name].steps = value.jobs[name].steps.filter(
      (step) => step.run !== "npm run browser:install",
    );
    assert.throws(
      () => inspectCi(stringify(value), applicationManifest()),
      /actual canonical commands/,
    );
  }
});

test("application jobs require genuine blocking checkout and Node setup before installing dependencies", () => {
  for (const name of ["build", "e2e", "visual"])
    for (const action of ["actions/checkout", "actions/setup-node"])
      for (const change of [
        (job, step) => {
          job.steps = job.steps.filter((item) => item !== step);
        },
        (_job, step) => {
          step.if = "always()";
        },
        (_job, step) => {
          step["continue-on-error"] = true;
        },
        (_job, step) => {
          step.name = action;
          delete step.uses;
        },
        (_job, step) => {
          step.uses = `${action}@latest`;
        },
        (_job, step) => {
          step.run = "echo not-an-action";
        },
        (job, step) => {
          job.steps.push({ ...step });
        },
        (job, step) => {
          job.steps = job.steps.filter((item) => item !== step);
          job.steps.push(step);
        },
      ]) {
        const value = applicationCi();
        const job = value.jobs[name];
        const step = job.steps.find((item) =>
          item.uses?.startsWith(`${action}@`),
        );
        change(job, step);
        assert.throws(
          () => inspectCi(stringify(value), applicationManifest()),
          /checkout|Node setup|unconditional|blocking|installation/,
        );
      }
  for (const name of ["build", "e2e", "visual"]) {
    const reversed = applicationCi();
    [reversed.jobs[name].steps[0], reversed.jobs[name].steps[1]] = [
      reversed.jobs[name].steps[1],
      reversed.jobs[name].steps[0],
    ];
    assert.throws(
      () => inspectCi(stringify(reversed), applicationManifest()),
      /checkout|Node setup|installation/,
    );
    const wrongNode = applicationCi();
    wrongNode.jobs[name].steps.find((step) =>
      step.uses?.startsWith("actions/setup-node@"),
    ).with = { "node-version": "20" };
    assert.throws(
      () => inspectCi(stringify(wrongNode), applicationManifest()),
      /Node setup/,
    );
  }
});

test("suffixed aliases do not count as canonical commands in application or full jobs", () => {
  const value = applicationCi();
  value.jobs.build.steps.push({ run: "npm run build-foo" });
  value.jobs.build.steps.push({ run: "custom-npm run build" });
  value.jobs.e2e.steps.push({ run: "npm run test:e2e:debug" });
  value.jobs.visual.steps.push({ run: "npm run test:visual-local" });
  value.jobs.check.steps.push({ run: "npm run validate -- full:debug" });
  value.jobs.check.steps.push({ run: "npm run browser:install-local" });
  value.jobs.check.steps.push({ run: "npm ci-local" });
  assert.deepEqual(inspectCi(stringify(value), applicationManifest()), {
    requiredChecks: 19,
  });
});

test("true canonical mentions remain visible behind separators and cannot be hidden by aliases", () => {
  for (const [name, command] of [
    ["build", "npm run build"],
    ["e2e", "npm run test:e2e"],
    ["visual", "npm run test:visual"],
    ["check", "npm run validate -- full"],
  ])
    for (const prefix of [
      "",
      "echo ready;",
      "echo ready && ",
      "echo ready | ",
      "echo ready\n",
    ])
      for (const suffix of [
        "",
        " ",
        "; echo finished",
        " && echo finished",
        " | echo finished",
        "\necho finished",
      ]) {
        const value = applicationCi();
        value.jobs[name].steps.push({ run: `${prefix}${command}${suffix}` });
        assert.throws(
          () => inspectCi(stringify(value), applicationManifest()),
          /exactly once|actual canonical/,
        );
      }
  for (const [name, command] of [
    ["build", "npm run build"],
    ["e2e", "npm run test:e2e"],
  ]) {
    const value = applicationCi();
    value.jobs[name].steps.find((step) => step.run === command).run =
      `${command}:debug`;
    assert.throws(
      () => inspectCi(stringify(value), applicationManifest()),
      /actual canonical/,
    );
  }
});

test("canonical CI and Sonar commands cannot be duplicated behind redirection", () => {
  for (const [inspect, create, declared, job] of [
    [inspectCi, prerequisiteCi, prerequisiteManifest, "check"],
    [inspectCi, applicationCi, applicationManifest, "check"],
    [inspectSonarWorkflow, sonarWorkflow, prerequisiteManifest, "analysis"],
    [inspectSonarWorkflow, applicationSonar, applicationManifest, "analysis"],
  ])
    for (const command of [
      "npm ci",
      "npm run browser:install",
      "npm run validate -- full",
    ])
      for (const redirect of [">output.log", ">>output.log", "<input.txt"]) {
        const value = create();
        value.jobs[job].steps.push({ run: `${command}${redirect}` });
        assert.throws(
          () => inspect(stringify(value), declared()),
          /exactly once/,
        );
      }
});

test("application commands cannot be duplicated behind redirection", () => {
  for (const [name, commands] of [
    ["build", ["npm ci", "npm run build", "npm run check:bundle"]],
    ["e2e", ["npm ci", "npm run browser:install", "npm run test:e2e"]],
    ["visual", ["npm ci", "npm run browser:install", "npm run test:visual"]],
  ])
    for (const command of commands)
      for (const redirect of [">output.log", ">>output.log", "<input.txt"]) {
        const value = applicationCi();
        value.jobs[name].steps.push({ run: `${command}${redirect}` });
        assert.throws(
          () => inspectCi(stringify(value), applicationManifest()),
          /actual canonical commands exactly once/,
        );
      }
});

test("application checkout accepts only the omitted or explicit repository-root path", () => {
  for (const name of ["build", "e2e", "visual"]) {
    for (const checkoutPath of [undefined, "."]) {
      const value = applicationCi();
      const checkout = value.jobs[name].steps.find((step) =>
        step.uses?.startsWith("actions/checkout@"),
      );
      checkout.with = { ...checkout.with, path: checkoutPath };
      assert.deepEqual(inspectCi(stringify(value), applicationManifest()), {
        requiredChecks: 19,
      });
    }
    for (const checkoutPath of [
      "other",
      "nested/source",
      "",
      null,
      false,
      0,
      "${{ github.workspace }}",
    ]) {
      const value = applicationCi();
      const checkout = value.jobs[name].steps.find((step) =>
        step.uses?.startsWith("actions/checkout@"),
      );
      checkout.with = { ...checkout.with, path: checkoutPath };
      assert.throws(
        () => inspectCi(stringify(value), applicationManifest()),
        /checkout must use the repository root/,
      );
    }
  }
});

test("application checkout must retain the pull-request default revision", () => {
  for (const name of ["build", "e2e", "visual"])
    for (const ref of ["main", "feature", "a".repeat(40), "", null, false, 0]) {
      const value = applicationCi();
      const checkout = value.jobs[name].steps.find((step) =>
        step.uses?.startsWith("actions/checkout@"),
      );
      checkout.with = { ...checkout.with, ref };
      assert.throws(
        () => inspectCi(stringify(value), applicationManifest()),
        /checkout must not select a ref/,
      );
    }
});

test("parenthesized commands cannot conceal duplicate canonical or application execution", () => {
  for (const [inspect, create, declared, job, commands] of [
    [
      inspectCi,
      prerequisiteCi,
      prerequisiteManifest,
      "check",
      ["npm ci", "npm run browser:install", "npm run validate -- full"],
    ],
    [
      inspectCi,
      applicationCi,
      applicationManifest,
      "check",
      ["npm ci", "npm run browser:install", "npm run validate -- full"],
    ],
    [
      inspectSonarWorkflow,
      sonarWorkflow,
      prerequisiteManifest,
      "analysis",
      ["npm ci", "npm run browser:install", "npm run validate -- full"],
    ],
    [
      inspectSonarWorkflow,
      applicationSonar,
      applicationManifest,
      "analysis",
      ["npm ci", "npm run browser:install", "npm run validate -- full"],
    ],
    [
      inspectCi,
      applicationCi,
      applicationManifest,
      "build",
      ["npm ci", "npm run build", "npm run check:bundle"],
    ],
    [
      inspectCi,
      applicationCi,
      applicationManifest,
      "e2e",
      ["npm ci", "npm run browser:install", "npm run test:e2e"],
    ],
    [
      inspectCi,
      applicationCi,
      applicationManifest,
      "visual",
      ["npm ci", "npm run browser:install", "npm run test:visual"],
    ],
  ])
    for (const command of commands)
      for (const duplicate of [
        `(${command})`,
        `( ${command})`,
        `(${command} )`,
      ]) {
        const value = create();
        value.jobs[job].steps.push({ run: duplicate });
        assert.throws(
          () => inspect(stringify(value), declared()),
          /exactly once/,
        );
      }
});
