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
      "CI installation and full validation must be unconditional and blocking",
    );
  inspectRunConfiguration(step);
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
  inspectRunConfiguration(workflow.defaults?.run);
  inspectRunConfiguration(job.defaults?.run);
  const commandSteps = (command) =>
    job.steps.flatMap((step, index) =>
      isRecord(step) &&
      typeof step.run === "string" &&
      step.run.trim() === command
        ? [{ index, step }]
        : [],
    );
  const installations = commandSteps("npm ci");
  const validations = commandSteps("npm run validate -- full");
  if (installations.length !== 1 || validations.length !== 1)
    throw new Error(
      "The check job must run npm ci and the canonical full command exactly once",
    );
  if (installations[0].index >= validations[0].index)
    throw new Error("CI must install dependencies before full validation");
  inspectCommandStep(installations[0].step);
  inspectCommandStep(validations[0].step);
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

export const inspectCi = (content, manifest) => {
  const document = parseDocument(content, { uniqueKeys: true });
  if (document.errors.length || document.warnings.length)
    throw new Error("CI must be valid YAML with unique mapping keys");
  const workflow = document.toJS({ maxAliasCount: 50 });
  if (!isRecord(workflow)) throw new Error("CI must be a workflow mapping");
  inspectPullRequestTrigger(workflow.on);
  inspectCheckJob(workflow);
  inspectCheckOwnership(manifest);
  return { requiredChecks: manifest.profiles.full.length };
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [content, manifest] = await Promise.all([
      readFile(path.join(repository, ".github/workflows/ci.yml"), "utf8"),
      readFile(path.join(repository, ".agents/validation.json"), "utf8"),
    ]);
    console.log(
      JSON.stringify({
        status: "passed",
        ...inspectCi(content, JSON.parse(manifest)),
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
