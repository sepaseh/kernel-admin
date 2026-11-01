import { readFileSync } from "node:fs";

import { parse, stringify } from "yaml";

import { lighthouseException, requiredCheckCommands } from "./check-ci.mjs";
import { validateManifest } from "./check-guidance.mjs";

export const fixture = () => {
  const manifest = {
    schemaVersion: 1,
    checks: [
      {
        id: "types",
        command: "npm run typecheck",
        kind: "required",
        ciJobs: ["check"],
        scopes: ["all"],
      },
      {
        id: "lab",
        command: "npm run lighthouse",
        kind: "advisory",
        ciJobs: [],
        scopes: ["focused"],
      },
    ],
    profiles: { full: ["types"], guidance: ["types", "lab"] },
  };
  const settings = {
    rules: [],
    skills: [],
    optionalHooks: [],
    navigation: ".agents/navigation.json",
    validation: ".agents/validation.json",
    evaluation: ".agents/evaluation/cases.json",
    recommendedChecks: ["npm run typecheck"],
    recommendedChecksSource: {
      path: ".agents/validation.json",
      profile: "full",
    },
  };
  const commands = [
    { run: "npm ci" },
    { run: "npm run browser:install" },
    { run: "npm run validate -- full" },
  ];
  const ci = {
    on: { pull_request: null },
    jobs: { check: { steps: structuredClone(commands) } },
  };
  const sonar = {
    on: { pull_request: null },
    jobs: {
      analysis: {
        steps: [
          ...structuredClone(commands),
          { uses: "SonarSource/sonarqube-scan-action@" + "a".repeat(40) },
        ],
      },
    },
  };
  return { manifest, settings, ci, sonar };
};

export const workflows = ({ ci, sonar }) => ({
  CI: stringify(ci),
  Sonar: stringify(sonar),
});

export const inspect = (state) =>
  validateManifest(state.manifest, state.settings, workflows(state));

export const phaseFixture = (phase) => {
  const state = fixture();
  const applicationReady = phase === "application-verification";
  const declaration = { phase, applicationReady };
  const checks = requiredCheckCommands(declaration).map(([id, command]) => ({
    id,
    command,
    kind: "required",
    ciJobs: ["check"],
    scopes: [phase],
  }));
  const full = checks.map(({ id }) => id);
  for (const [id, command, kind] of [
    ["guidance-tests", "npm run test:guidance", "advisory"],
    ["visual", "npm run test:visual", "manual"],
    ["browser-compatibility", "npm run test:e2e:complete", "manual"],
    ["lighthouse", "npm run test:lighthouse:verified", "advisory"],
  ])
    checks.push({
      id,
      command,
      kind,
      ciJobs: applicationReady && id !== "guidance-tests" ? ["check"] : [],
      scopes: [phase],
      ...(id === "lighthouse"
        ? {
            exception: {
              ...lighthouseException,
              reason: "Synthetic policy fixture",
            },
          }
        : {}),
    });
  state.manifest = {
    schemaVersion: 1,
    ...declaration,
    verificationModel: "single-pass-v1",
    checks,
    profiles: {
      full,
      guidance: ["guidance", "guidance-tests"],
      complete: applicationReady
        ? [...full.slice(0, -1), "browser-compatibility", "visual"]
        : [...full],
      visual: ["visual"],
      performance: ["lighthouse"],
    },
  };
  state.settings.recommendedChecks = checks
    .filter(({ kind }) => kind === "required")
    .map(({ command }) => command);
  state.ci = parse(
    readFileSync(
      new URL("../.github/workflows/ci.yml", import.meta.url),
      "utf8",
    ),
  );
  state.sonar = structuredClone(state.ci);
  return state;
};

export const taskFixture = () => ({
  navigation: {
    schemaVersion: 1,
    tasks: [
      {
        id: "account",
        when: "Change profile",
        owners: ["owner.ts"],
        contracts: [],
        tests: ["test.ts"],
        checks: ["types"],
      },
    ],
  },
  evaluation: {
    schemaVersion: 1,
    cases: [
      {
        id: "profile",
        prompt: { en: "Explain" },
        taskIds: ["account"],
        evidence: ["owner.ts"],
        mustExplain: ["HTTP ownership"],
        mustNot: ["Import persistence"],
        checks: ["types"],
      },
    ],
  },
});
