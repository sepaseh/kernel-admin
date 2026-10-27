import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseDocument } from "yaml";

const repository = fileURLToPath(new URL("../", import.meta.url));
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

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
  { command: "npm ci", mention: /(?:^|[\s;&|])npm\s+ci\b/ },
  {
    command: "npm run browser:install",
    mention: /(?:^|[\s;&|])npm\s+run\s+browser:install\b/,
  },
  {
    command: "npm run validate -- full",
    mention: /(?:^|[\s;&|])npm\s+run\s+validate\s+--\s+full\b/,
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
  if (
    ids.some((id) => {
      const jobs = checks.get(id)?.ciJobs;
      return !Array.isArray(jobs) || jobs.length !== 1 || jobs[0] !== "check";
    })
  )
    throw new Error(
      "Every current full-profile check must belong only to check; multiple jobs need a deliberate policy transition",
    );
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
  return { requiredChecks: manifest.profiles.full.length };
};

const sameRepositoryCondition =
  "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository";

export const inspectSonarWorkflow = (content, manifest) => {
  const workflow = parseWorkflow(content);
  inspectPullRequestTrigger(workflow.on);
  const job = workflow.jobs?.analysis;
  if (!isRecord(job) || !Array.isArray(job.steps))
    throw new Error("Sonar must declare its analysis job and steps");
  const condition =
    typeof job.if === "string"
      ? job.if
          .trim()
          .replace(/^\$\{\{\s*|\s*\}\}$/g, "")
          .replace(/\s+/g, " ")
      : undefined;
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
    /^SonarSource\/sonarqube-scan-action@[a-f0-9]{40}$/.test(step.uses)
      ? [{ index, step }]
      : [],
  );
  if (scanners.length !== 1 || scanners[0].index <= fullIndex)
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
