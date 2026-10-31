import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const executionModes = new Set([
  "--scope",
  "--record-coverage",
  "--verify-coverage",
  "--prepare-reuse",
  "--accept-reuse",
  "--performance-scope",
]);
let parseDocument;

export const lighthouseException = {
  owner: "Kernel Admin frontend/test maintainer",
  reviewBy: "2026-11-07",
  expiresAt: "2026-11-07T00:00:00Z",
};

const requiredCommands = [
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
  ["application-build", "npm run build:verification"],
  ["bundle", "npm run check:bundle"],
  ["contract", "npm run test:contract"],
  ["application-e2e", "npm run test:e2e"],
];
const sha = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{40}$/.test(value) &&
  !/^0+$/.test(value);
const git = (...args) =>
  execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    windowsHide: true,
  }).trimEnd();

export const visualInputsChanged = (files) => {
  if (!Array.isArray(files)) throw new Error("Changed paths must be an array");
  return files.some((file) => {
    if (
      typeof file !== "string" ||
      !file ||
      /[\\\0\r\n]/.test(file) ||
      file.split("/").some((part) => !part || part === "." || part === "..")
    )
      throw new Error("Changed paths must be safe repository paths");
    return !/^(?:docs\/|\.agents\/|\.github\/(?:PULL_REQUEST_TEMPLATE\.md|CODEOWNERS)$|(?:README|CONTRIBUTING|AGENTS|CLAUDE|SECURITY|DESIGN)(?:\.fa)?\.md$)/.test(
      file,
    );
  });
};

export const selectVerificationScope = ({
  event,
  eventName,
  commit,
  tree,
  files,
  applicationReady = true,
}) => {
  if (
    !["pull_request", "push", "schedule", "workflow_dispatch"].includes(
      eventName,
    )
  )
    throw new Error("Unsupported verification event");
  if (!isRecord(event) || !sha(commit) || !sha(tree))
    throw new Error(
      "A verified event and checked-out commit/tree are required",
    );
  const pullRequest = eventName === "pull_request";
  const head = pullRequest ? event.pull_request?.head?.sha : commit;
  const base = pullRequest
    ? event.pull_request?.base?.sha
    : sha(event.before) && !/^0+$/.test(event.before)
      ? event.before
      : commit;
  if (!sha(head) || !sha(base))
    throw new Error("The tested source head and base must be exact commits");
  const retargeted =
    pullRequest &&
    event.action === "edited" &&
    Object.hasOwn(event.changes ?? {}, "base");
  const run = !(pullRequest && event.action === "edited" && !retargeted);
  const complete =
    applicationReady &&
    (eventName === "schedule" ||
      (eventName === "workflow_dispatch" &&
        event.inputs?.verification === "complete"));
  return {
    run: String(run),
    application: String(applicationReady),
    profile: complete ? "complete" : "full",
    browser_install: complete ? "browser:install:all" : "browser:install",
    visual: String(
      applicationReady &&
        run &&
        (complete || retargeted || visualInputsChanged(files)),
    ),
    head,
    base,
    commit,
    tree,
  };
};

export const selectPerformanceScope = (now = new Date()) => {
  const instant = new Date(now).getTime();
  if (!Number.isFinite(instant))
    throw new Error("A valid verification time is required");
  return {
    advisory: String(instant < Date.parse(lighthouseException.expiresAt)),
  };
};

const coverageFiles = [
  "coverage/unit/lcov.info",
  "coverage/governance/lcov.info",
];
export const validateCoverageIdentity = (identity) => {
  if (
    !isRecord(identity) ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9_.-]+$/.test(
      identity.repository ?? "",
    ) ||
    identity.repository
      .split("/")
      .some((part) => part === "." || part === "..") ||
    ["head", "base", "commit", "tree"].some((key) => !sha(identity[key])) ||
    ["runId", "runAttempt"].some(
      (key) => !/^[1-9][0-9]*$/.test(identity[key] ?? ""),
    )
  )
    throw new Error(
      "Coverage identity requires the repository, source head/base, tested commit/tree and producer run/attempt",
    );
  return identity;
};
export const coverageManifest = (identity, contents, verification = {}) => {
  validateCoverageIdentity(identity);
  if (
    !isRecord(contents) ||
    Object.keys(contents).length !== coverageFiles.length
  )
    throw new Error(
      "Exactly the measured unit and governance LCOV files are required",
    );
  return {
    schemaVersion: 1,
    identity,
    verification: {
      applicationReady: verification.applicationReady === true,
      performanceAdvisory: verification.performanceAdvisory === true,
      performanceOutcome: verification.performanceOutcome ?? "not-applicable",
      recordedAt: verification.recordedAt ?? new Date().toISOString(),
    },
    files: coverageFiles.map((file) => {
      const bytes = contents[file];
      if (
        !Buffer.isBuffer(bytes) ||
        !/^SF:/m.test(bytes.toString("utf8")) ||
        !/^end_of_record\r?$/m.test(bytes.toString("utf8"))
      )
        throw new Error("Measured LCOV content is required: " + file);
      return {
        path: file,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
      };
    }),
  };
};
export const verifyCoverageManifest = (manifest, expected, contents) => {
  validateCoverageIdentity(expected);
  const actual = coverageManifest(expected, contents);
  if (
    manifest?.schemaVersion !== 1 ||
    !isRecord(manifest.identity) ||
    Object.keys(expected).some(
      (key) => manifest.identity[key] !== expected[key],
    ) ||
    Object.keys(manifest.identity).length !== Object.keys(expected).length ||
    JSON.stringify(manifest.files) !== JSON.stringify(actual.files)
  )
    throw new Error(
      "Coverage artifacts do not match the exact tested source, base/tree, producer run and LCOV hashes",
    );
  return true;
};

const priorVerificationRun = (runs, expected) =>
  runs
    .filter(
      (run) =>
        String(run.id) !== expected.runId &&
        run.head_sha === expected.head &&
        run.head_repository?.full_name === expected.repository &&
        run.path?.split("@")[0] === ".github/workflows/ci.yml",
    )
    .sort((left, right) => {
      const time = (run) => {
        const value = Date.parse(run.updated_at ?? run.created_at ?? "");
        return Number.isFinite(value) ? value : 0;
      };
      return time(right) - time(left);
    })[0];
export const reusableCoverageCandidate = (runs, artifacts, expected) => {
  validateCoverageIdentity(expected);
  if (!Array.isArray(runs) || !Array.isArray(artifacts)) return undefined;
  const latest = priorVerificationRun(runs, expected);
  if (
    !latest ||
    latest.status !== "completed" ||
    latest.conclusion !== "success"
  )
    return undefined;
  for (const run of [latest]) {
    for (const artifact of artifacts) {
      const match = /^verification-([1-9][0-9]*)-([1-9][0-9]*)$/.exec(
        artifact.name ?? "",
      );
      if (artifact.expired === false && match?.[1] === String(run.id))
        return {
          artifact: artifact.name,
          runId: match[1],
          runAttempt: match[2],
        };
    }
  }
  return undefined;
};

export const verifyReusedCoverage = (
  report,
  expected,
  candidate,
  run,
  contents,
  { applicationReady, now = new Date() } = {},
) => {
  if (
    applicationReady !== undefined &&
    report?.verification?.applicationReady !== applicationReady
  )
    throw new Error(
      "Previous verification belongs to a different application phase",
    );
  if (
    applicationReady === true &&
    selectPerformanceScope(now).advisory === "false" &&
    (report?.verification?.performanceAdvisory !== false ||
      report.verification.performanceOutcome !== "success")
  )
    throw new Error(
      "The advisory exception expired; fresh blocking performance verification is required",
    );
  const found = reusableCoverageCandidate(
    [run],
    [{ name: candidate?.artifact, expired: false }],
    expected,
  );
  if (
    !found ||
    found.runId !== candidate.runId ||
    found.runAttempt !== candidate.runAttempt ||
    !sha(report?.identity?.commit)
  )
    throw new Error(
      "Previous verification must be a completed successful CI producer",
    );
  const producer = {
    ...expected,
    commit: report.identity.commit,
    runId: candidate.runId,
    runAttempt: candidate.runAttempt,
  };
  verifyCoverageManifest(report, producer, contents);
  return producer;
};

const parseWorkflow = (content) => {
  const document = parseDocument(content, { uniqueKeys: true });
  if (document.errors.length || document.warnings.length)
    throw new Error("CI must be valid YAML with unique mapping keys");
  const workflow = document.toJS({ maxAliasCount: 50 });
  if (!isRecord(workflow)) throw new Error("CI must be a workflow mapping");
  return workflow;
};
const rootExecution = (value) => {
  if (
    value?.["working-directory"] !== undefined &&
    value["working-directory"] !== "."
  )
    throw new Error("CI commands must use the repository root");
  if (value?.shell !== undefined)
    throw new Error("CI commands must use the default shell");
};
const blocking = (step, { condition } = {}) => {
  if (
    !isRecord(step) ||
    (step["continue-on-error"] !== undefined &&
      step["continue-on-error"] !== false) ||
    (condition === undefined
      ? Object.hasOwn(step, "if")
      : step.if !== condition)
  )
    throw new Error(
      "Required execution must be blocking and use only its declared condition",
    );
  rootExecution(step);
};
const commandStep = (job, command, options) => {
  const token = command
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll(" ", String.raw`\s+`);
  const mention = new RegExp(
    String.raw`(?:^|[\s;&|<>()])${token}(?=$|[\s;&|<>()])`,
  );
  const matches = job.steps.flatMap((step, index) =>
    typeof step?.run === "string" && mention.test(step.run)
      ? [{ step, index }]
      : [],
  );
  if (
    matches.length !== 1 ||
    matches[0].step.run.trim() !== command ||
    matches[0].step.uses !== undefined
  )
    throw new Error(
      "Canonical command must execute exactly once without aliases or wrappers: " +
        command,
    );
  blocking(matches[0].step, options);
  return matches[0].index;
};
const pinnedAction = (job, action, options) => {
  const matches = job.steps.flatMap((step, index) =>
    typeof step?.uses === "string" && step.uses.startsWith(action + "@")
      ? [{ step, index }]
      : [],
  );
  if (
    matches.length !== 1 ||
    !new RegExp("^" + action.replaceAll("/", "\\/") + "@[a-f0-9]{40}$").test(
      matches[0].step.uses,
    ) ||
    matches[0].step.run !== undefined
  )
    throw new Error(
      "Each action must occur exactly once with an immutable pin: " + action,
    );
  blocking(matches[0].step, options);
  return matches[0];
};
const triggerPolicy = (workflow) => {
  if (Object.hasOwn(workflow.on ?? {}, "pull_request_target"))
    throw new Error(
      "Privileged pull_request_target execution is not permitted",
    );
  const trigger = workflow.on?.pull_request;
  if (
    !isRecord(trigger) ||
    ["paths", "paths-ignore", "branches", "branches-ignore"].some((key) =>
      Object.hasOwn(trigger, key),
    ) ||
    ["opened", "synchronize", "reopened", "edited", "ready_for_review"].some(
      (name) => !trigger.types?.includes(name),
    )
  )
    throw new Error(
      "PR validation must retain all lifecycle events, including base-retargeting edits, without global filters",
    );
  if (
    !Array.isArray(workflow.on.schedule) ||
    !workflow.on.schedule.length ||
    workflow.on.workflow_dispatch?.inputs?.verification?.default !==
      "complete" ||
    !workflow.on.workflow_dispatch.inputs.verification.options?.includes(
      "complete",
    )
  )
    throw new Error(
      "Complete browser verification needs scheduled and explicit pre-release execution",
    );
};
const inspectHostedManifest = (manifest) => {
  const checks = new Map(manifest.checks.map((check) => [check.id, check]));
  for (const [id, command, kind] of [
    ["browser-compatibility", "npm run test:e2e:complete", "manual"],
    ["visual", "npm run test:visual", "manual"],
    ["lighthouse", "npm run test:lighthouse:verified", "advisory"],
  ]) {
    const check = checks.get(id);
    if (
      check?.command !== command ||
      check.kind !== kind ||
      JSON.stringify(check.ciJobs) !== '["check"]'
    )
      throw new Error(
        "Hosted verification needs its exact declared scope and owner: " + id,
      );
  }
  const complete = [
    ...manifest.profiles.full.slice(0, -1),
    "browser-compatibility",
    "visual",
  ];
  if (
    JSON.stringify(manifest.profiles.complete) !== JSON.stringify(complete) ||
    JSON.stringify(manifest.profiles.visual) !== '["visual"]' ||
    JSON.stringify(manifest.profiles.performance) !== '["lighthouse"]'
  )
    throw new Error(
      "Complete verification must replace Chromium with the full browser matrix and compare images once",
    );
  const exception = checks.get("lighthouse").exception;
  if (
    !isRecord(exception) ||
    Object.entries(lighthouseException).some(
      ([key, value]) => exception[key] !== value,
    ) ||
    !exception.reason?.trim()
  )
    throw new Error(
      "The Lighthouse advisory exception needs its bounded expiry, owner and reason",
    );
};
const manifestPolicy = (manifest) => {
  if (
    !Array.isArray(manifest.checks) ||
    new Set(manifest.checks.map((check) => check.id)).size !==
      manifest.checks.length
  )
    throw new Error("Validation check definitions must be unique");
  const required = manifest.checks.filter((check) => check.kind === "required");
  const application = manifest.applicationReady === true;
  const expected = application
    ? requiredCommands
    : requiredCommands.slice(0, 12);
  if (application && manifest.phase !== "application-verification")
    throw new Error(
      "Application checks require the application-verification phase",
    );
  if (
    JSON.stringify(manifest.profiles?.full) !==
      JSON.stringify(expected.map(([id]) => id)) ||
    required.length !== expected.length ||
    expected.some(
      ([id, command], index) =>
        required[index]?.id !== id ||
        required[index]?.command !== command ||
        JSON.stringify(required[index]?.ciJobs) !== '["check"]',
    )
  )
    throw new Error(
      "The full profile must preserve every exact required core check once with one CI owner",
    );
  if (application) inspectHostedManifest(manifest);
  return required.length;
};
const job = (workflow, name) => {
  const value = workflow.jobs?.[name];
  if (
    !isRecord(value) ||
    !Array.isArray(value.steps) ||
    value["runs-on"] !== "windows-2025" ||
    Object.hasOwn(value, "strategy") ||
    (value["continue-on-error"] !== undefined &&
      value["continue-on-error"] !== false)
  )
    throw new Error(
      "CI needs a blocking Windows job with its declared execution scope: " +
        name,
    );
  rootExecution(workflow.defaults?.run);
  rootExecution(value.defaults?.run);
  for (const step of value.steps) rootExecution(step);
  return value;
};
const setup = (value, { ref } = {}) => {
  const checkout = pinnedAction(value, "actions/checkout");
  const node = pinnedAction(value, "actions/setup-node");
  if (
    checkout.index >= node.index ||
    (checkout.step.with?.path !== undefined &&
      checkout.step.with.path !== ".") ||
    (ref === undefined
      ? Object.hasOwn(checkout.step.with ?? {}, "ref")
      : checkout.step.with?.ref !== ref) ||
    checkout.step.with?.["persist-credentials"] !== false ||
    node.step.with?.["node-version-file"] !== ".nvmrc" ||
    node.step.with?.["node-version"] !== undefined
  )
    throw new Error(
      "CI checkout must retain the exact tested revision and root; Node must use .nvmrc before execution",
    );
  return node.index;
};

const inspectLegacyWorkflow = (workflow, manifest, scanner) => {
  const events = workflow.on;
  const names =
    typeof events === "string"
      ? [events]
      : Array.isArray(events)
        ? events
        : Object.keys(events ?? {});
  if (!names.includes("pull_request"))
    throw new Error("CI must run on pull_request events");
  const trigger = isRecord(events) ? events.pull_request : undefined;
  if (
    isRecord(trigger) &&
    (["paths", "paths-ignore", "branches", "branches-ignore"].some((key) =>
      Object.hasOwn(trigger, key),
    ) ||
      (trigger.types !== undefined &&
        (!Array.isArray(trigger.types) ||
          ["opened", "synchronize", "reopened", "ready_for_review"].some(
            (name) => !trigger.types.includes(name),
          ))))
  )
    throw new Error("PR validation must not filter its required lifecycle");
  const value = workflow.jobs?.[scanner ? "analysis" : "check"];
  const sameRepository =
    "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository";
  const condition = typeof value?.if === "string" ? value.if.trim() : undefined;
  const normalized = (
    condition?.startsWith("${{") && condition.endsWith("}}")
      ? condition.slice(3, -2).trim()
      : condition
  )?.replace(/\s+/g, " ");
  if (
    !isRecord(value) ||
    !Array.isArray(value.steps) ||
    Object.hasOwn(value, "needs") ||
    Object.hasOwn(value, "strategy") ||
    (value["continue-on-error"] !== undefined &&
      value["continue-on-error"] !== false) ||
    (Object.hasOwn(value, "if") && (!scanner || normalized !== sameRepository))
  )
    throw new Error("Legacy execution must remain unconditional and blocking");
  rootExecution(workflow.defaults?.run);
  rootExecution(value.defaults?.run);
  const positions = [
    "npm ci",
    "npm run browser:install",
    "npm run validate -- full",
  ].map((command) => commandStep(value, command));
  if (!(positions[0] < positions[1] && positions[1] < positions[2]))
    throw new Error("Legacy prerequisites must run before full validation");
  const required = manifest.checks?.filter(
    (check) => check.kind === "required",
  );
  if (
    !Array.isArray(required) ||
    !Array.isArray(manifest.profiles?.full) ||
    manifest.profiles.full.length !== required.length ||
    new Set(manifest.profiles.full).size !== required.length ||
    required.some((check) => !manifest.profiles.full.includes(check.id)) ||
    new Set(required.map((check) => check.id)).size !== required.length ||
    required.some((check) => JSON.stringify(check.ciJobs) !== '["check"]')
  )
    throw new Error("Legacy full ownership must preserve every required check");
  if (scanner) {
    const scan = pinnedAction(value, "SonarSource/sonarqube-scan-action");
    if (scan.index <= positions[2])
      throw new Error(
        "Legacy scanner must follow actual canonical verification",
      );
  } else if (
    ["build", "e2e", "visual"].some((name) =>
      Object.hasOwn(workflow.jobs ?? {}, name),
    )
  )
    throw new Error(
      "Application jobs require their deliberate phase transition",
    );
  return { requiredChecks: required.length };
};

const inspectScopeSelection = (workflow) => {
  const scope = job(workflow, "scope");
  if (Object.hasOwn(scope, "if") || Object.hasOwn(scope, "needs"))
    throw new Error("Scope selection must run independently for every event");
  const scopeSetup = setup(scope);
  if (commandStep(scope, "node scripts/check-ci.mjs --scope") <= scopeSetup)
    throw new Error(
      "Scope selection requires its checkout and Node prerequisites",
    );
  const scopeStep = scope.steps.find(
    (step) => step.run === "node scripts/check-ci.mjs --scope",
  );
  if (
    scopeStep.id !== "scope" ||
    [
      "run",
      "profile",
      "browser_install",
      "visual",
      "application",
      "head",
      "base",
      "commit",
      "tree",
    ].some(
      (key) => scope.outputs?.[key] !== `\${{ steps.scope.outputs.${key} }}`,
    )
  )
    throw new Error(
      "Verification scope outputs must bind the actual scope computation",
    );
};

const inspectCheckSource = (workflow) => {
  const check = job(workflow, "check");
  if (
    check.name !== undefined ||
    check.needs !== "scope" ||
    check.if !== "always()"
  )
    throw new Error(
      "The native check must depend only on the verified source scope",
    );
  if (
    check.steps[0]?.env?.SCOPE_RESULT !== "${{ needs.scope.result }}" ||
    check.steps[0]?.run !==
      'if ($env:SCOPE_RESULT -ne "success") { throw "Source scope selection failed; verification cannot be established." }'
  )
    throw new Error(
      "The required check must fail when scope selection is not successful",
    );
  const checkSetup = setup(check, { ref: "${{ needs.scope.outputs.commit }}" });
  if (
    check.env?.KERNEL_REUSE_VERIFICATION_BUILD !== "1" ||
    ["HEAD", "BASE", "COMMIT", "TREE"].some(
      (key) =>
        check.env?.["VERIFICATION_" + key] !==
        `\${{ needs.scope.outputs.${key.toLowerCase()} }}`,
    ) ||
    check.outputs?.coverage_artifact !==
      "${{ steps.coverage.outputs.artifact }}" ||
    check.outputs?.coverage_attempt !==
      "${{ steps.coverage.outputs.attempt }}" ||
    check.outputs?.coverage_run_id !== "${{ steps.coverage.outputs.run_id }}"
  )
    throw new Error(
      "Check coverage and build reuse must bind the exact scope and producer outputs",
    );
  return { check, checkSetup };
};

const inspectEvidenceReuse = (check, checkSetup) => {
  const prepare = commandStep(
    check,
    "node scripts/check-ci.mjs --prepare-reuse",
  );
  const accept = commandStep(check, "node scripts/check-ci.mjs --accept-reuse");
  const candidate = check.steps.find((step) => step.id === "reuse-download");
  const candidateIndex = check.steps.indexOf(candidate);
  if (
    check.steps[prepare].id !== "reuse-candidate" ||
    check.steps[accept].id !== "reuse" ||
    candidate?.uses !==
      "actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0" ||
    candidate.if !== "steps.reuse-candidate.outputs.artifact != ''" ||
    candidate["continue-on-error"] !== true ||
    candidate.with?.name !== "${{ steps.reuse-candidate.outputs.artifact }}" ||
    candidate.with?.path !== "coverage" ||
    candidate.with?.["run-id"] !==
      "${{ steps.reuse-candidate.outputs.runId }}" ||
    candidate.with?.["github-token"] !== "${{ github.token }}" ||
    !(
      checkSetup < prepare &&
      prepare < candidateIndex &&
      candidateIndex < accept
    )
  )
    throw new Error(
      "Metadata reuse requires verified prior-producer evidence before deciding whether to run fresh checks",
    );
  return accept;
};

const inspectCoreCommands = (check, accept, fresh) => {
  const install = commandStep(check, "npm ci", { condition: fresh });
  const browser = commandStep(
    check,
    "npm run ${{ needs.scope.outputs.browser_install }}",
    { condition: fresh },
  );
  const full = commandStep(
    check,
    "npm run validate -- ${{ needs.scope.outputs.profile }}",
    { condition: fresh },
  );
  const allowedCommands = new Set([
    "npm ci",
    "npm run ${{ needs.scope.outputs.browser_install }}",
    "npm run validate -- ${{ needs.scope.outputs.profile }}",
    "npm run validate -- visual",
    "npm run validate -- performance",
  ]);
  if (
    check.steps.some(
      (step) =>
        typeof step.run === "string" &&
        /(?:^|[\s;&|<>()])npm\s/.test(step.run) &&
        !allowedCommands.has(step.run),
    )
  )
    throw new Error(
      "CI must not add duplicate or unregistered npm executions outside the canonical profiles",
    );
  if (!(accept < install && install < browser && browser < full))
    throw new Error(
      "CI must install dependencies and the selected browsers before canonical verification",
    );
  return full;
};

const inspectHostedChecks = (check, full, appFresh) => {
  const visual = commandStep(check, "npm run validate -- visual", {
    condition:
      appFresh +
      " && needs.scope.outputs.profile == 'full' && needs.scope.outputs.visual == 'true'",
  });
  if (visual <= full)
    throw new Error("Conditional images must run once after core validation");
  const performance = check.steps.filter(
    (step) => step.run === "npm run validate -- performance",
  );
  const performancePolicy = commandStep(
    check,
    "node scripts/check-ci.mjs --performance-scope",
    { condition: appFresh },
  );
  if (
    performance.length !== 1 ||
    performance[0].id !== "performance" ||
    performance[0]["continue-on-error"] !==
      "${{ steps.performance-policy.outputs.advisory == 'true' }}" ||
    performance[0].if !== appFresh ||
    check.steps[performancePolicy].id !== "performance-policy" ||
    performancePolicy !== check.steps.indexOf(performance[0]) - 1
  )
    throw new Error(
      "Performance must execute once and its advisory status must expire automatically",
    );
  return { visual, performance: check.steps.indexOf(performance[0]) };
};

const inspectCoveragePublication = (check, visual, performance, fresh) => {
  const record = commandStep(
    check,
    "node scripts/check-ci.mjs --record-coverage",
  );
  if (check.steps[record].id !== "coverage")
    throw new Error("Coverage provenance must be the declared producer step");
  if (
    check.steps[record].env?.VERIFICATION_APPLICATION !==
      "${{ needs.scope.outputs.application }}" ||
    check.steps[record].env?.VERIFICATION_PERFORMANCE_ADVISORY !==
      "${{ steps.performance-policy.outputs.advisory }}" ||
    check.steps[record].env?.VERIFICATION_PERFORMANCE_OUTCOME !==
      "${{ steps.performance.outcome }}" ||
    check.steps[record].env?.VERIFICATION_REUSED !==
      "${{ steps.reuse.outputs.reused }}"
  )
    throw new Error(
      "Coverage evidence must preserve the actual application phase and observed performance policy/outcome",
    );
  const upload = pinnedAction(check, "actions/upload-artifact", {
    condition: "always() && " + fresh,
  });
  if (
    record <= visual ||
    performance <= visual ||
    record <= performance ||
    upload.index <= record ||
    upload.step.with?.name !==
      "verification-${{ github.run_id }}-${{ github.run_attempt }}" ||
    upload.step.with?.path?.trim() !==
      "coverage/unit/lcov.info\ncoverage/governance/lcov.info\ncoverage/verification-coverage.json\ncoverage/e2e/\ncoverage/visual/\ncoverage/lighthouse/" ||
    upload.step.with?.["if-no-files-found"] !== "warn" ||
    upload.step.with?.overwrite !== false
  )
    throw new Error(
      "Measured coverage must be recorded and uploaded once after successful canonical verification",
    );
};

export const inspectCi = (content, manifest) => {
  const workflow = parseWorkflow(content);
  if (
    manifest.verificationModel !== "single-pass-v1" &&
    manifest.applicationReady !== true
  )
    return inspectLegacyWorkflow(workflow, manifest, false);
  triggerPolicy(workflow);
  const requiredChecks = manifestPolicy(manifest);
  if (
    workflow.permissions?.actions !== "read" ||
    workflow.concurrency?.group !==
      "ci-${{ github.ref }}-${{ github.event_name == 'pull_request' && github.event.action == 'edited' && !github.event.changes.base && 'metadata' || 'source' }}"
  )
    throw new Error(
      "Metadata runs need read-only evidence access and must not cancel active source verification",
    );
  if (
    JSON.stringify(Object.keys(workflow.jobs ?? {}).sort()) !==
    '["analysis","check","scope"]'
  )
    throw new Error(
      "Each suite must have one execution owner; duplicate build/browser/image jobs are not allowed",
    );
  inspectScopeSelection(workflow);
  const { check, checkSetup } = inspectCheckSource(workflow);
  const accept = inspectEvidenceReuse(check, checkSetup);
  const fresh = "steps.reuse.outputs.reused != 'true'";
  const appFresh = "needs.scope.outputs.application == 'true' && " + fresh;
  const full = inspectCoreCommands(check, accept, fresh);
  const { visual, performance } = inspectHostedChecks(check, full, appFresh);
  inspectCoveragePublication(check, visual, performance, fresh);
  inspectSonarWorkflow(content, manifest);
  return { requiredChecks };
};

export const inspectSonarWorkflow = (content, manifest) => {
  const workflow = parseWorkflow(content);
  if (
    manifest.verificationModel !== "single-pass-v1" &&
    manifest.applicationReady !== true
  )
    return inspectLegacyWorkflow(workflow, manifest, true);
  const requiredChecks = manifestPolicy(manifest);
  const analysis = job(workflow, "analysis");
  if (
    analysis.name !== "SonarQube Cloud analysis" ||
    JSON.stringify(analysis.needs) !== '["scope","check"]' ||
    analysis.if !==
      "needs.scope.result == 'success' && needs.check.result == 'success' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)"
  )
    throw new Error(
      "The native scanner must consume the successful check from this exact source scope and retain its fork condition",
    );
  const ready = setup(analysis, { ref: "${{ needs.scope.outputs.commit }}" });
  if (
    ["HEAD", "BASE", "COMMIT", "TREE"].some(
      (key) =>
        analysis.env?.["VERIFICATION_" + key] !==
        `\${{ needs.scope.outputs.${key.toLowerCase()} }}`,
    ) ||
    analysis.env?.VERIFICATION_COVERAGE_ATTEMPT !==
      "${{ needs.check.outputs.coverage_attempt }}" ||
    analysis.env?.VERIFICATION_COVERAGE_RUN_ID !==
      "${{ needs.check.outputs.coverage_run_id }}"
  )
    throw new Error(
      "Sonar coverage identity must bind the tested scope and producer attempt",
    );
  const download = pinnedAction(analysis, "actions/download-artifact");
  const verify = commandStep(
    analysis,
    "node scripts/check-ci.mjs --verify-coverage",
  );
  const scan = pinnedAction(analysis, "SonarSource/sonarqube-scan-action");
  const analysisInstall = commandStep(analysis, "npm ci --ignore-scripts");
  if (
    !(
      ready < download.index &&
      download.index < verify &&
      verify < analysisInstall &&
      analysisInstall < scan.index
    ) ||
    download.step.with?.name !==
      "${{ needs.check.outputs.coverage_artifact }}" ||
    download.step.with?.path !== "coverage" ||
    download.step.with?.["run-id"] !==
      "${{ needs.check.outputs.coverage_run_id }}" ||
    download.step.with?.["github-token"] !== "${{ github.token }}" ||
    analysis.steps.some(
      (step) =>
        typeof step.run === "string" &&
        /(?:npm\s+(?:ci|run)|playwright)/.test(step.run) &&
        step.run !== "npm ci --ignore-scripts",
    )
  )
    throw new Error(
      "Sonar must verify and consume existing measured coverage without rerunning installation, builds or tests",
    );
  if (
    scan.step.env?.SONAR_TOKEN !== "${{ secrets.SONAR_TOKEN }}" ||
    scan.step.with?.args !==
      "-Dsonar.projectKey=${{ vars.SONAR_PROJECT_KEY }} -Dsonar.scm.revision=${{ needs.scope.outputs.head }}"
  )
    throw new Error(
      "The scanner must retain configured credentials and bind the actual source head",
    );
  return { requiredChecks };
};

const expectedIdentity = () =>
  validateCoverageIdentity({
    repository: process.env.GITHUB_REPOSITORY,
    head: process.env.VERIFICATION_HEAD,
    base: process.env.VERIFICATION_BASE,
    commit: process.env.VERIFICATION_COMMIT,
    tree: process.env.VERIFICATION_TREE,
    runId:
      process.env.VERIFICATION_COVERAGE_RUN_ID ?? process.env.GITHUB_RUN_ID,
    runAttempt:
      process.env.VERIFICATION_COVERAGE_ATTEMPT ??
      process.env.GITHUB_RUN_ATTEMPT,
  });
const output = (values) =>
  appendFile(
    process.env.GITHUB_OUTPUT,
    Object.entries(values)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(""),
  );
const githubJson = async (identity, route) => {
  if (!process.env.GITHUB_TOKEN)
    throw new Error(
      "Read-only Actions access is required to verify previous evidence",
    );
  const response = await fetch(
    `https://api.github.com/repos/${identity.repository}/${route}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok)
    throw new Error(
      "Previous verification evidence is unavailable (HTTP " +
        response.status +
        ")",
    );
  return response.json();
};
const previousCandidate = () => ({
  artifact: process.env.VERIFICATION_REUSE_ARTIFACT,
  runId: process.env.VERIFICATION_REUSE_RUN_ID,
  runAttempt: process.env.VERIFICATION_REUSE_ATTEMPT,
});
const readCoverageProvenance = async () => {
  const filename = path.join(repository, "coverage/verification-coverage.json");
  const status = await lstat(filename);
  if (!status.isFile() || status.isSymbolicLink())
    throw new Error("Coverage provenance must be an ordinary artifact file");
  return JSON.parse(await readFile(filename, "utf8"));
};
const reusePolicy = async () => ({
  applicationReady:
    JSON.parse(
      await readFile(path.join(repository, ".agents/validation.json"), "utf8"),
    ).applicationReady === true,
  now: new Date(),
});
const readCoverage = async () =>
  Object.fromEntries(
    await Promise.all(
      coverageFiles.map(async (file) => {
        const filename = path.join(repository, file);
        const status = await lstat(filename);
        if (!status.isFile() || status.isSymbolicLink())
          throw new Error("Coverage must be ordinary measured files");
        return [file, await readFile(filename)];
      }),
    ),
  );
const recordVerificationScope = async () => {
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  const commit = git("rev-parse", "HEAD");
  const tree = git("rev-parse", "HEAD^{tree}");
  const compare =
    process.env.GITHUB_EVENT_NAME === "pull_request"
      ? event.pull_request?.base?.sha
      : event.before;
  const files =
    sha(compare) && !/^0+$/.test(compare)
      ? git("diff", "--name-only", "-z", compare, commit)
          .split("\0")
          .filter(Boolean)
      : ["package.json"];
  const result = selectVerificationScope({
    event,
    eventName: process.env.GITHUB_EVENT_NAME,
    commit,
    tree,
    files,
    applicationReady:
      JSON.parse(
        await readFile(
          path.join(repository, ".agents/validation.json"),
          "utf8",
        ),
      ).applicationReady === true,
  });
  await output(result);
  return;
};
const prepareCoverageReuse = async (identity) => {
  if (process.env.VERIFICATION_METADATA_ONLY !== "true") return;
  try {
    const runs = await githubJson(
      identity,
      `actions/workflows/ci.yml/runs?head_sha=${identity.head}&per_page=20`,
    );
    const run = priorVerificationRun(runs.workflow_runs ?? [], identity);
    if (run) {
      if (run.status !== "completed" || run.conclusion !== "success") return;
      const artifacts = await githubJson(
        identity,
        `actions/runs/${run.id}/artifacts?per_page=100`,
      );
      const candidate = reusableCoverageCandidate(
        [run],
        artifacts.artifacts,
        identity,
      );
      if (candidate) {
        await output(candidate);
        return;
      }
    }
  } catch {
    console.warn(
      "Previous verification could not be established; fresh canonical checks will run.",
    );
  }
  return;
};
const acceptCoverageReuse = async (identity) => {
  if (
    process.env.VERIFICATION_REUSE_DOWNLOAD !== "success" ||
    !process.env.VERIFICATION_REUSE_RUN_ID
  ) {
    await output({ reused: "false" });
    return;
  }
  try {
    const candidate = previousCandidate();
    const run = await githubJson(identity, `actions/runs/${candidate.runId}`);
    verifyReusedCoverage(
      await readCoverageProvenance(),
      identity,
      candidate,
      run,
      await readCoverage(),
      await reusePolicy(),
    );
    await output({ reused: "true" });
    console.log(
      "Reused an actual successful CI producer for unchanged source head, base and tested tree; no fresh test execution is claimed.",
    );
  } catch {
    await output({ reused: "false" });
    console.warn(
      "Previous verification did not match this source/base/tree; fresh canonical checks will run.",
    );
  }
  return;
};
const recordMeasuredCoverage = async (identity) => {
  const contents = await readCoverage();
  const filename = path.join(repository, "coverage/verification-coverage.json");
  if (process.env.VERIFICATION_REUSED === "true") {
    const candidate = previousCandidate();
    verifyReusedCoverage(
      await readCoverageProvenance(),
      identity,
      candidate,
      await githubJson(identity, `actions/runs/${candidate.runId}`),
      contents,
      await reusePolicy(),
    );
    await output({
      artifact: candidate.artifact,
      attempt: candidate.runAttempt,
      run_id: candidate.runId,
    });
    return;
  }
  await writeFile(
    filename,
    JSON.stringify(
      coverageManifest(identity, contents, {
        applicationReady: process.env.VERIFICATION_APPLICATION === "true",
        performanceAdvisory:
          process.env.VERIFICATION_PERFORMANCE_ADVISORY === "true",
        performanceOutcome:
          process.env.VERIFICATION_PERFORMANCE_OUTCOME || "not-applicable",
      }),
      null,
      2,
    ) + "\n",
  );
  const artifact = `verification-${identity.runId}-${identity.runAttempt}`;
  await output({
    artifact,
    attempt: identity.runAttempt,
    run_id: identity.runId,
  });
};
const verifyMeasuredCoverage = async (identity) => {
  const contents = await readCoverage();
  const report = await readCoverageProvenance();
  if (identity.runId !== process.env.GITHUB_RUN_ID) {
    const candidate = {
      artifact: `verification-${identity.runId}-${identity.runAttempt}`,
      runId: identity.runId,
      runAttempt: identity.runAttempt,
    };
    verifyReusedCoverage(
      report,
      { ...identity, runId: process.env.GITHUB_RUN_ID },
      candidate,
      await githubJson(identity, `actions/runs/${identity.runId}`),
      contents,
      await reusePolicy(),
    );
    identity.commit = report.identity.commit;
  }
  verifyCoverageManifest(report, identity, contents);
  if (!process.env.SONAR_PROJECT_KEY)
    throw new Error(
      "Configure SONAR_PROJECT_KEY before analysis. No Sonar analysis was performed.",
    );
  console.log(
    "Verified measured unit/governance coverage for the exact source head, base/tree and producer run.",
  );
};
const executeEvidence = async (mode) => {
  if (mode === "--performance-scope") {
    await output(selectPerformanceScope());
    return;
  }
  if (mode === "--scope") {
    await recordVerificationScope();
    return;
  }
  const identity = expectedIdentity();
  if (
    git("rev-parse", "HEAD") !== process.env.VERIFICATION_COMMIT ||
    git("rev-parse", "HEAD^{tree}") !== identity.tree
  )
    throw new Error(
      "The checked-out revision/tree differs from the tested coverage source",
    );

  const operation = {
    "--prepare-reuse": prepareCoverageReuse,
    "--accept-reuse": acceptCoverageReuse,
    "--record-coverage": recordMeasuredCoverage,
    "--verify-coverage": verifyMeasuredCoverage,
  }[mode];
  await operation(identity);
};

if (isMain && executionModes.has(process.argv[2])) {
  try {
    await executeEvidence(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
} else {
  ({ parseDocument } = await import("yaml"));
  if (isMain) {
    try {
      const [content, manifest] = await Promise.all([
        readFile(path.join(repository, ".github/workflows/ci.yml"), "utf8"),
        readFile(path.join(repository, ".agents/validation.json"), "utf8"),
      ]);
      console.log(
        JSON.stringify({
          status: "passed",
          ...inspectCi(content, JSON.parse(manifest)),
          scannerValidated: true,
        }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({ status: "failed", message: error.message }),
      );
      process.exitCode = 1;
    }
  }
}
