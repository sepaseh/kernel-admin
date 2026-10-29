import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";

const repository = fileURLToPath(new URL("../", import.meta.url));
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const applicationJobs = [
  {
    name: "build",
    browser: false,
    checks: [
      { id: "application-build", command: "npm run build" },
      { id: "bundle", command: "npm run check:bundle" },
    ],
  },
  {
    name: "e2e",
    browser: true,
    checks: [{ id: "application-e2e", command: "npm run test:e2e" }],
  },
  {
    name: "visual",
    browser: true,
    checks: [{ id: "visual", command: "npm run test:visual" }],
  },
];
const applicationRequiredChecks = [
  ["snapshot", "npm run check:snapshot"],
  ["ci-policy", "npm run check:ci"],
  ["guidance", "npm run check:guidance"],
  ["audit", "npm run audit"],
  ["boundaries", "npm run check:boundaries"],
  ["typecheck", "npm run typecheck"],
  ["lint", "npm run lint"],
  ["format", "npm run format:check"],
  ["unit-coverage", "npm run test:coverage"],
  ["governance-coverage", "npm run test:governance"],
  ["storybook-build", "npm run build-storybook"],
  ["storybook-browser", "npm run test:storybook"],
  ["unused", "npm run check:unused"],
  ["application-build", "npm run build"],
  ["bundle", "npm run check:bundle"],
  ["contract", "npm run test:contract"],
  ["application-e2e", "npm run test:e2e"],
  ["visual", "npm run test:visual"],
  ["lighthouse", "npm run test:lighthouse"],
];

const inspectPullRequestTrigger = (events) => {
  if (typeof events === "string" || Array.isArray(events)) {
    const names = Array.isArray(events) ? events : [events];
    if (!names.includes("pull_request"))
      throw new Error("CI must run on pull_request events");
    return;
  }
  if (!isRecord(events) || !Object.hasOwn(events, "pull_request"))
    throw new Error("CI must run on pull_request events");
  const trigger = events.pull_request;
  if (trigger === null || trigger === undefined) return;
  if (!isRecord(trigger))
    throw new Error("The pull_request trigger must be an event mapping");
  if (
    ["paths", "paths-ignore", "branches", "branches-ignore"].some((key) =>
      Object.hasOwn(trigger, key),
    )
  )
    throw new Error("PR validation must not use path or branch filters");
  if (
    trigger.types !== undefined &&
    (!Array.isArray(trigger.types) ||
      ["opened", "synchronize", "reopened", "ready_for_review"].some(
        (type) => !trigger.types.includes(type),
      ))
  )
    throw new Error(
      "PR validation must include every required lifecycle event",
    );
};

const inspectRunConfiguration = (configuration) => {
  if (
    configuration?.["working-directory"] !== undefined &&
    configuration["working-directory"] !== "."
  )
    throw new Error("CI validation must run from the repository root");
  if (configuration?.shell !== undefined)
    throw new Error("CI validation must not override the default shell");
};

const inspectCommandStep = (step) => {
  if (
    Object.hasOwn(step, "if") ||
    (step["continue-on-error"] !== undefined &&
      step["continue-on-error"] !== false) ||
    step.uses !== undefined
  )
    throw new Error(
      "CI installation, browser setup and full validation must be unconditional and blocking",
    );
  inspectRunConfiguration(step);
};

const canonicalCommands = [
  { command: "npm ci", mention: /(?:^|[\s;&|])npm\s+ci(?=$|[\s;&|])/ },
  {
    command: "npm run browser:install",
    mention: /(?:^|[\s;&|])npm\s+run\s+browser:install(?=$|[\s;&|])/,
  },
  {
    command: "npm run validate -- full",
    mention: /(?:^|[\s;&|])npm\s+run\s+validate\s+--\s+full(?=$|[\s;&|])/,
  },
];

const inspectCanonicalExecution = (workflow, job) => {
  inspectRunConfiguration(workflow.defaults?.run);
  inspectRunConfiguration(job.defaults?.run);
  const positions = canonicalCommands.map(({ command, mention }) => {
    const matches = job.steps.flatMap((step, index) =>
      isRecord(step) && typeof step.run === "string" && mention.test(step.run)
        ? [{ index, step }]
        : [],
    );
    if (matches.length !== 1 || matches[0].step.run.trim() !== command)
      throw new Error(
        "The job must run npm ci, npm run browser:install and the canonical full command exactly once as separate steps",
      );
    inspectCommandStep(matches[0].step);
    return matches[0].index;
  });
  if (positions[0] >= positions[1] || positions[1] >= positions[2])
    throw new Error(
      "CI must install dependencies, then browser dependencies, before full validation",
    );
  return { fullIndex: positions[2] };
};

const inspectCheckJob = (workflow) => {
  const job = workflow.jobs?.check;
  if (!isRecord(job) || !Array.isArray(job.steps))
    throw new Error("CI must declare its check job and steps");
  if (
    Object.hasOwn(job, "if") ||
    Object.hasOwn(job, "needs") ||
    Object.hasOwn(job, "strategy") ||
    (job["continue-on-error"] !== undefined &&
      job["continue-on-error"] !== false)
  )
    throw new Error(
      "The check job must run independently without conditional or advisory execution",
    );
  inspectCanonicalExecution(workflow, job);
};

const inspectCheckOwnership = (manifest) => {
  const ids = manifest?.profiles?.full;
  if (!Array.isArray(ids) || !ids.length || !Array.isArray(manifest.checks))
    throw new Error("The canonical full validation profile is required");
  const checks = new Map(manifest.checks.map((check) => [check.id, check]));
  const application = manifest.applicationReady === true;
  if (
    application &&
    (manifest.phase !== "application-verification" ||
      ids.length !== applicationRequiredChecks.length ||
      new Set(ids).size !== ids.length ||
      checks.size !== manifest.checks.length ||
      manifest.checks.filter((check) => check.kind === "required").length !==
        applicationRequiredChecks.length ||
      applicationRequiredChecks.some(
        ([id, command], index) =>
          ids[index] !== id ||
          checks.get(id)?.kind !== "required" ||
          checks.get(id)?.command !== command,
      ))
  )
    throw new Error(
      "The application-verification phase needs all nineteen exact required checks without duplicate or unknown entries",
    );
  const additionalOwners = new Map(
    applicationJobs.flatMap((job) =>
      job.checks.map((check) => [check.id, job.name]),
    ),
  );
  if (
    ids.some((id) => {
      const jobs = checks.get(id)?.ciJobs;
      const owner = application ? additionalOwners.get(id) : undefined;
      const expected = owner ? ["check", owner] : ["check"];
      return (
        !Array.isArray(jobs) ||
        jobs.length !== expected.length ||
        jobs.some((job, index) => job !== expected[index])
      );
    })
  )
    throw new Error(
      "Full-profile ownership requires its deliberate phase policy transition",
    );
};

const inspectApplicationSetup = (steps, installationIndex) => {
  const positions = ["checkout", "setup-node"].map((action) => {
    const matches = steps.flatMap((step, index) =>
      isRecord(step) &&
      typeof step.uses === "string" &&
      step.uses.startsWith(`actions/${action}@`)
        ? [{ step, index }]
        : [],
    );
    if (
      matches.length !== 1 ||
      !/^actions\/(?:checkout|setup-node)@[a-f0-9]{40}$/.test(
        matches[0].step.uses,
      ) ||
      matches[0].step.run !== undefined ||
      Object.hasOwn(matches[0].step, "if") ||
      (matches[0].step["continue-on-error"] !== undefined &&
        matches[0].step["continue-on-error"] !== false)
    )
      throw new Error(
        "Application checkout and Node setup must each be pinned, unconditional and blocking",
      );
    const { step, index } = matches[0];
    inspectRunConfiguration(step);
    if (
      action === "setup-node" &&
      (step.with?.["node-version-file"] !== ".nvmrc" ||
        step.with?.["node-version"] !== undefined)
    )
      throw new Error("Application Node setup must use the repository .nvmrc");
    return index;
  });
  if (positions[0] >= positions[1] || positions[1] >= installationIndex)
    throw new Error(
      "Application checkout and Node setup must precede dependency installation in that order",
    );
};

const inspectApplicationJob = (workflow, definition) => {
  const job = workflow.jobs?.[definition.name];
  if (
    !isRecord(job) ||
    !Array.isArray(job.steps) ||
    (job.name !== undefined && job.name !== definition.name) ||
    job["runs-on"] !== "windows-2025" ||
    ["if", "needs", "strategy"].some((key) => Object.hasOwn(job, key)) ||
    (job["continue-on-error"] !== undefined &&
      job["continue-on-error"] !== false)
  )
    throw new Error(
      `Application ${definition.name} job must be an independent blocking Windows job with its native name`,
    );
  inspectRunConfiguration(workflow.defaults?.run);
  inspectRunConfiguration(job.defaults?.run);
  const commands = [
    "npm ci",
    ...(definition.browser ? ["npm run browser:install"] : []),
    ...definition.checks.map((check) => check.command),
  ];
  const positions = commands.map((command) => {
    const commandPattern = command.replaceAll(" ", String.raw`\s+`);
    const mention = new RegExp(
      String.raw`(?:^|[\s;&|])${commandPattern}(?=$|[\s;&|])`,
    );
    const matches = job.steps.flatMap((step, index) =>
      isRecord(step) && typeof step.run === "string" && mention.test(step.run)
        ? [{ step, index }]
        : [],
    );
    if (matches.length !== 1 || matches[0].step.run.trim() !== command)
      throw new Error(
        `Application ${definition.name} job must run its actual canonical commands exactly once`,
      );
    inspectCommandStep(matches[0].step);
    return matches[0].index;
  });
  if (
    positions.some(
      (position, index) => index > 0 && position <= positions[index - 1],
    )
  )
    throw new Error(
      "Application installation must precede browser setup and checks",
    );
  inspectApplicationSetup(job.steps, positions[0]);
};

const inspectApplicationJobs = (workflow, manifest) => {
  if (manifest.applicationReady !== true) {
    if (
      applicationJobs.some((job) =>
        Object.hasOwn(workflow.jobs ?? {}, job.name),
      )
    )
      throw new Error(
        "Application jobs require a deliberate phase policy transition",
      );
    return;
  }
  if (workflow.jobs.check["runs-on"] !== "windows-2025")
    throw new Error(
      "The complete application check must use Windows visual prerequisites",
    );
  for (const definition of applicationJobs)
    inspectApplicationJob(workflow, definition);
};

const parseWorkflow = (content) => {
  const document = parseDocument(content, { uniqueKeys: true });
  if (document.errors.length || document.warnings.length)
    throw new Error("CI must be valid YAML with unique mapping keys");
  const workflow = document.toJS({ maxAliasCount: 50 });
  if (!isRecord(workflow)) throw new Error("CI must be a workflow mapping");
  return workflow;
};

export const inspectCi = (content, manifest) => {
  const workflow = parseWorkflow(content);
  inspectPullRequestTrigger(workflow.on);
  inspectCheckJob(workflow);
  inspectCheckOwnership(manifest);
  inspectApplicationJobs(workflow, manifest);
  return { requiredChecks: manifest.profiles.full.length };
};

const sameRepositoryCondition =
  "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository";

const normalizeCondition = (condition) => {
  const trimmed = condition.trim();
  const expression =
    trimmed.startsWith("${{") && trimmed.endsWith("}}")
      ? trimmed.slice(3, -2).trim()
      : trimmed;
  return expression.replace(/\s+/g, " ");
};

const portableSonarGuard = [
  "node --input-type=module -e 'if (!process.env.SONAR_TOKEN ||",
  '!process.env.SONAR_PROJECT_KEY) { console.error("Configure SONAR_TOKEN',
  "and SONAR_PROJECT_KEY before analysis. No Sonar analysis was",
  "performed.\"); process.exit(1); }'",
].join(" ");

const inspectWindowsSonarReadiness = (job, fullIndex) => {
  if (job["runs-on"] !== "windows-2025")
    throw new Error(
      "The complete application scanner must use Windows visual prerequisites",
    );
  const guards = job.steps.flatMap((step, index) =>
    isRecord(step) && step.env?.SONAR_PROJECT_KEY !== undefined && step.run
      ? [{ step, index }]
      : [],
  );
  if (
    guards.length !== 1 ||
    guards[0].index >= fullIndex ||
    guards[0].step.uses !== undefined ||
    typeof guards[0].step.run !== "string" ||
    guards[0].step.run.trim().replace(/\s+/g, " ") !== portableSonarGuard ||
    guards[0].step.env.SONAR_TOKEN !== "${{ secrets.SONAR_TOKEN }}" ||
    guards[0].step.env.SONAR_PROJECT_KEY !== "${{ vars.SONAR_PROJECT_KEY }}"
  )
    throw new Error(
      "Windows Sonar requires its portable Node readiness guard before full validation",
    );
};

export const inspectSonarWorkflow = (content, manifest) => {
  const workflow = parseWorkflow(content);
  inspectPullRequestTrigger(workflow.on);
  const job = workflow.jobs?.analysis;
  if (!isRecord(job) || !Array.isArray(job.steps))
    throw new Error("Sonar must declare its analysis job and steps");
  const condition =
    typeof job.if === "string" ? normalizeCondition(job.if) : undefined;
  if (
    (Object.hasOwn(job, "if") && condition !== sameRepositoryCondition) ||
    Object.hasOwn(job, "needs") ||
    Object.hasOwn(job, "strategy") ||
    (job["continue-on-error"] !== undefined &&
      job["continue-on-error"] !== false)
  )
    throw new Error(
      "The analysis job may only use its same-repository fork condition and must be blocking",
    );
  const { fullIndex } = inspectCanonicalExecution(workflow, job);
  for (const step of job.steps.slice(0, fullIndex + 1)) {
    if (
      !isRecord(step) ||
      Object.hasOwn(step, "if") ||
      (step["continue-on-error"] !== undefined &&
        step["continue-on-error"] !== false)
    )
      throw new Error(
        "Sonar prerequisites must be unconditional and blocking before full validation",
      );
    inspectRunConfiguration(step);
  }
  const scanners = job.steps.flatMap((step, index) =>
    isRecord(step) &&
    typeof step.uses === "string" &&
    step.uses.startsWith("SonarSource/sonarqube-scan-action@")
      ? [{ index, step }]
      : [],
  );
  if (
    scanners.length !== 1 ||
    scanners[0].index <= fullIndex ||
    !/^SonarSource\/sonarqube-scan-action@[a-f0-9]{40}$/.test(
      scanners[0].step.uses,
    )
  )
    throw new Error(
      "Sonar must scan exactly once after the canonical full validation",
    );
  const scanner = scanners[0].step;
  if (
    Object.hasOwn(scanner, "if") ||
    scanner.run !== undefined ||
    (scanner["continue-on-error"] !== undefined &&
      scanner["continue-on-error"] !== false)
  )
    throw new Error(
      "The Sonar scan must be unconditional and blocking within its analysis job",
    );
  inspectRunConfiguration(scanner);
  inspectCheckOwnership(manifest);
  if (manifest.applicationReady === true)
    inspectWindowsSonarReadiness(job, fullIndex);
  return { requiredChecks: manifest.profiles.full.length };
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [content, sonar, manifest] = await Promise.all([
      readFile(path.join(repository, ".github/workflows/ci.yml"), "utf8"),
      readFile(path.join(repository, ".github/workflows/sonar.yml"), "utf8"),
      readFile(path.join(repository, ".agents/validation.json"), "utf8"),
    ]);
    const declared = JSON.parse(manifest);
    inspectSonarWorkflow(sonar, declared);
    console.log(
      JSON.stringify({
        status: "passed",
        ...inspectCi(content, declared),
        scannerValidated: true,
      }).replaceAll(/[\r\n\u2028\u2029]/g, " "),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        status: "failed",
        message:
          error instanceof Error ? error.message : "CI validation failed",
      }).replaceAll(/[\r\n\u2028\u2029]/g, " "),
    );
    process.exitCode = 1;
  }
}
