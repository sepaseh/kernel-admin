import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFile,
  lstat,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const repository = fileURLToPath(new URL("../", import.meta.url));
const gitExecutable =
  process.platform === "win32"
    ? String.raw`C:\Program Files\Git\bin\git.exe`
    : "/usr/bin/git";
const suites = new Set(["unit", "governance"]);
const powershellReport = "coverage/governance/powershell.xml";
const powershellSource = "scripts/stop-visual-process-tree.ps1";
const buildRecord = "coverage/verification-build.json";
const buildManifest = "coverage/ci-build-evidence.json";
export const maximumCoverageBytes = 32 * 1024 * 1024;
const sha = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{40}$/.test(value) &&
  !/^0+$/.test(value);
const positive = (value) =>
  typeof value === "string" && /^[1-9]\d*$/.test(value);

export const sourceIdentity = ({
  environment,
  event,
  git,
  producerAttempt,
}) => {
  const commit = git(["rev-parse", "HEAD"]).trim();
  const tree = git(["rev-parse", "HEAD^{tree}"]).trim();
  const workflow = git(["rev-parse", "HEAD:.github/workflows/ci.yml"]).trim();
  const repositoryName = environment.GITHUB_REPOSITORY;
  const pullRequest = environment.GITHUB_EVENT_NAME === "pull_request";
  const push = environment.GITHUB_EVENT_NAME === "push";
  const head = pullRequest ? event.pull_request?.head?.sha : commit;
  const pushedBase =
    push && event.before !== "0".repeat(40) ? event.before : null;
  const base = pullRequest ? event.pull_request?.base?.sha : pushedBase;
  const attempt = producerAttempt ?? environment.GITHUB_RUN_ATTEMPT;
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repositoryName ?? "") ||
    repositoryName.split("/").some((part) => part === "." || part === "..") ||
    event.repository?.full_name !== repositoryName ||
    !["pull_request", "push", "schedule", "workflow_dispatch"].includes(
      environment.GITHUB_EVENT_NAME,
    ) ||
    (pullRequest &&
      event.pull_request?.base?.repo?.full_name !== repositoryName) ||
    ![commit, tree, workflow, head].every(sha) ||
    ((pullRequest || push) && base !== null && !sha(base)) ||
    (pullRequest && !sha(base)) ||
    (push && event.after !== commit) ||
    commit !== environment.GITHUB_SHA ||
    !positive(environment.GITHUB_RUN_ID) ||
    !positive(environment.GITHUB_RUN_ATTEMPT) ||
    !positive(attempt) ||
    BigInt(attempt) > BigInt(environment.GITHUB_RUN_ATTEMPT) ||
    git(["diff", "--name-only", "HEAD", "--"]).trim()
  )
    throw new Error(
      "CI evidence requires the exact clean checkout and GitHub event identity",
    );
  return {
    repository: repositoryName,
    head,
    base,
    commit,
    tree,
    workflow,
    runId: environment.GITHUB_RUN_ID,
    attempt,
  };
};

const safeRelative = (value) => {
  const normalized = value.replaceAll("\\", "/");
  if (
    !normalized ||
    /[:\0\r\n]/.test(normalized) ||
    normalized.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error(
      "Coverage source paths must be safe relative repository paths",
    );
  return normalized;
};

const regularFile = async (root, relative, optional = false) => {
  const parts = safeRelative(relative).split("/");
  let filename = path.resolve(root);
  const rootInfo = await lstat(filename);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink())
    throw new Error("CI evidence root must be an ordinary directory");
  for (const [index, part] of parts.entries()) {
    filename = path.join(filename, part);
    let info;
    try {
      info = await lstat(filename);
    } catch (error) {
      if (optional && index === parts.length - 1 && error.code === "ENOENT")
        return { filename };
      throw error;
    }
    if (
      info.isSymbolicLink() ||
      (index === parts.length - 1 ? !info.isFile() : !info.isDirectory())
    )
      throw new Error(
        "CI evidence and source paths must not contain links or special files",
      );
    if (index === parts.length - 1) return { filename, info };
  }
};

const parseCoverageLine = (line, record) => {
  if (line.startsWith("SF:")) {
    if (record.source)
      throw new Error("LCOV records must end before another source");
    record.source = safeRelative(line.slice(3));
    record.sources.add(record.source);
    return;
  }
  if (line.startsWith("DA:")) {
    if (!record.source || !/^DA:[1-9]\d*,\d+(?:,[^,\s]+)?$/.test(line))
      throw new Error("LCOV requires valid measured line records");
    record.measured = true;
    return;
  }
  if (line === "end_of_record") {
    if (!record.source)
      throw new Error("LCOV records require an existing source");
    record.source = undefined;
    record.records++;
    return;
  }
  if (line && !/^[A-Z][A-Z0-9_]*:/.test(line))
    throw new Error("LCOV contains a malformed record");
};

const coverageSources = (bytes) => {
  const record = {
    source: undefined,
    measured: false,
    records: 0,
    sources: new Set(),
  };
  const lines = new TextDecoder("utf-8", { fatal: true })
    .decode(bytes)
    .split(/\r?\n/);
  for (const line of lines) parseCoverageLine(line, record);
  if (record.source || !record.records || !record.measured)
    throw new Error("LCOV must contain complete measured source records");
  return record.sources;
};

export const readCoverage = async (
  root,
  reportPath = "coverage/unit/lcov.info",
) => {
  const { filename, info } = await regularFile(root, reportPath);
  if (info.size === 0 || info.size > maximumCoverageBytes)
    throw new Error("Measured LCOV must be nonempty and at most 32 MiB");
  const bytes = await readFile(filename);
  if (bytes.length === 0 || bytes.length > maximumCoverageBytes)
    throw new Error("Measured LCOV must be nonempty and at most 32 MiB");
  await Promise.all(
    [...coverageSources(bytes)].map((source) => regularFile(root, source)),
  );
  return bytes;
};

export const evidenceManifest = (identity, reports, suite) => ({
  schemaVersion: 1,
  suite,
  identity,
  coverage: reports.map(({ reportPath, bytes }) => ({
    path: reportPath,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  })),
});

const emitOutputs = async (values, { environment, output }) => {
  if (output) await output(values);
  else
    await appendFile(
      environment.GITHUB_OUTPUT,
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(""),
    );
};

const publishEvidence = async (filename, evidence, options) => {
  await writeFile(filename, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  const { suite, identity } = evidence;
  const artifactPrefix = suite ? `coverage-${suite}` : "verification-build";
  await emitOutputs(
    {
      artifact: `${artifactPrefix}-${identity.runId}-${identity.attempt}`,
      attempt: identity.attempt,
    },
    options,
  );
};

const readOrdinary = async (
  root,
  relative,
  maximum = maximumCoverageBytes,
  allowEmpty = false,
) => {
  const { filename, info } = await regularFile(root, relative);
  if ((!allowEmpty && !info.size) || info.size > maximum)
    throw new Error("CI evidence file is empty or too large: " + relative);
  const bytes = await readFile(filename);
  if ((!allowEmpty && !bytes.length) || bytes.length > maximum)
    throw new Error("CI evidence file is empty or too large: " + relative);
  return bytes;
};

const readPowershellCoverage = async (root, required) => {
  const { info } = await regularFile(root, powershellReport, !required);
  if (!info) return;
  const bytes = await readOrdinary(root, powershellReport);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
  const body =
    /^<coverage version="1">\s*<file path="scripts\/stop-visual-process-tree\.ps1">([\s\S]*)<\/file>\s*<\/coverage>$/.exec(
      text.replace(/^<\?xml[^?]*\?>\s*/, ""),
    )?.[1];
  const line =
    /<lineToCover lineNumber="([1-9]\d*)" covered="(true|false)"\s*\/>/g;
  const entries = [...(body ?? "").matchAll(line)];
  const numbers = entries.map((entry) => Number(entry[1]));
  if (
    body === undefined ||
    body.replace(line, "").trim() ||
    !entries.some((entry) => entry[2] === "true") ||
    numbers.some((number) => !Number.isSafeInteger(number)) ||
    new Set(numbers).size !== numbers.length
  )
    throw new Error(
      "PowerShell coverage must contain genuine measured source lines",
    );
  const source = await readOrdinary(root, powershellSource);
  if (
    numbers.some(
      (number) => number > source.toString("utf8").split(/\r?\n/).length,
    )
  )
    throw new Error("PowerShell coverage contains a line outside its source");
  return { reportPath: powershellReport, bytes };
};

const fileEvidence = (relative, bytes) => ({
  path: relative,
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
});

const readDistribution = async (root, relative = "dist") => {
  // Inspect each directory before enumerating it, including empty or added paths.
  const info = await lstat(path.join(root, relative));
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("Verification build paths must be ordinary directories");
  const entries = (
    await readdir(path.join(root, relative), { withFileTypes: true })
  ).sort((left, right) => left.name.localeCompare(right.name, "en"));
  const results = await Promise.allSettled(
    entries.map(async (entry) => {
      const filename = `${relative}/${entry.name}`;
      safeRelative(filename);
      if (entry.isDirectory()) return readDistribution(root, filename);

      return [
        fileEvidence(
          filename,
          await readOrdinary(root, filename, maximumCoverageBytes, true),
        ),
      ];
    }),
  );
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;

  return results.flatMap((result) => result.value);
};

const verifyBuildSource = async (root, record) => {
  const inventoryName = ".github/bootstrap-policy.json";
  const inventory = JSON.parse(await readOrdinary(root, inventoryName));
  if (
    !Array.isArray(inventory.allowedFiles) ||
    new Set(inventory.allowedFiles).size !== inventory.allowedFiles.length ||
    inventory.allowedFiles.some(
      (file) => typeof file !== "string" || safeRelative(file) !== file,
    )
  )
    throw new Error(
      "Verification build requires the admitted public source inventory",
    );
  // Match the existing verification-build owner; these reviewed examples are omitted there.
  const excluded = new Set([
    ".env.example",
    "deploy/docker/.env.example",
    "deploy/native/hosts.env.example",
  ]);
  const inputs = [...new Set([inventoryName, ...inventory.allowedFiles])]
    .filter((file) => !excluded.has(file))
    .sort((left, right) => {
      if (left < right) return -1;
      if (left > right) return 1;
      return 0;
    });
  if (inputs.some((file) => /(?:^|\/)\.env(?:\.|$)/i.test(file)))
    throw new Error(
      "Operator environments cannot supply verification build source",
    );
  if (!isDeepStrictEqual(record.sourceInputs, inputs))
    throw new Error(
      "Verification build source inputs differ from the admitted inventory",
    );
  const hash = createHash("sha256");
  const contents = await Promise.allSettled(
    inputs.map((file) => readOrdinary(root, file, maximumCoverageBytes, true)),
  );
  const failure = contents.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;

  inputs.forEach((file, index) => {
    const bytes = contents[index].value;
    hash
      .update(file)
      .update("\0")
      .update(String(bytes.length))
      .update("\0")
      .update(bytes);
  });
  if (record.sourceFingerprint !== hash.digest("hex"))
    throw new Error(
      "Verification build source fingerprint does not match this checkout",
    );
};

const buildEvidence = async (root, identity, environment) => {
  const recordBytes = await readOrdinary(root, buildRecord);
  const record = JSON.parse(recordBytes);
  const expectedEnvironment = {
    KERNEL_SYNTHETIC_ENV: "1",
    VITE_API_BASE_URL: "https://api.example.com",
    VITE_APP_BASE_URL: "/",
    VITE_OBSERVABILITY_URL: "",
    VITE_RELEASE_ID: "application-verification",
  };
  if (
    record.schemaVersion !== 1 ||
    !isDeepStrictEqual(record.environment, expectedEnvironment) ||
    Object.entries(expectedEnvironment).some(
      ([key, value]) => (environment[key] ?? "") !== value,
    )
  )
    throw new Error(
      "Verification build requires its original synthetic environment",
    );
  await verifyBuildSource(root, record);
  const files = await readDistribution(root);
  const distribution = files.map((file) => ({
    ...file,
    path: file.path.slice("dist/".length),
  }));
  if (
    !files.some((file) => file.path === "dist/index.html") ||
    !isDeepStrictEqual(record.distribution, distribution)
  )
    throw new Error(
      "Verification build distribution does not match its recorded bytes",
    );
  const metadata = JSON.parse(
    await readOrdinary(root, "dist/_kernel/build.json"),
  );
  if (
    !isDeepStrictEqual(record.build, metadata) ||
    metadata.schemaVersion !== 1 ||
    metadata.apiOrigin !== expectedEnvironment.VITE_API_BASE_URL ||
    metadata.basePath !== expectedEnvironment.VITE_APP_BASE_URL ||
    metadata.releaseId !== expectedEnvironment.VITE_RELEASE_ID
  )
    throw new Error(
      "Verification build metadata does not match its recorded environment",
    );
  return {
    schemaVersion: 1,
    identity,
    files: [fileEvidence(buildRecord, recordBytes), ...files],
  };
};

const verifyManifest = async (
  root,
  relative,
  expected,
  maximum = 16 * 1024,
) => {
  const bytes = await readOrdinary(root, relative, maximum);
  if (!isDeepStrictEqual(JSON.parse(bytes), expected))
    throw new Error(
      "CI evidence does not match the exact source, workflow, producer or measured bytes",
    );
};

const runCoverageEvidence = async ({
  root,
  suite,
  platform,
  identity,
  verifying,
  options,
}) => {
  const reportPath = `coverage/${suite}/lcov.info`;
  const manifestPath = `coverage/${suite}/ci-evidence.json`;
  const bytes = await readCoverage(root, reportPath);
  const powershell =
    suite === "governance"
      ? await readPowershellCoverage(root, platform === "win32")
      : undefined;
  const reports = [{ reportPath, bytes }, ...(powershell ? [powershell] : [])];
  const expected = evidenceManifest(identity, reports, suite);
  const { filename } = await regularFile(root, manifestPath, !verifying);
  if (verifying) {
    await verifyManifest(root, manifestPath, expected);
    if (suite === "governance")
      await emitOutputs(
        { powershell_report: powershell ? powershellReport : "" },
        options,
      );
  } else {
    await publishEvidence(filename, expected, options);
  }
};

export const runEvidence = async (
  mode,
  {
    root = repository,
    environment = process.env,
    event,
    git,
    output,
    platform = process.platform,
  } = {},
) => {
  if (
    ![
      "--record",
      "--verify-coverage",
      "--record-build",
      "--verify-build",
    ].includes(mode)
  )
    throw new Error(
      "Usage: ci-evidence.mjs --record|--verify-coverage|--record-build|--verify-build",
    );
  const build = mode.endsWith("-build");
  const suite = environment.CI_EVIDENCE_SUITE;
  if (!build && !suites.has(suite))
    throw new Error("CI evidence requires a declared unit or governance suite");
  const readGit =
    git ??
    ((args) =>
      // Never resolve Git through a writable PATH.
      execFileSync(gitExecutable, args, {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      }));
  const payload =
    event ?? JSON.parse(await readFile(environment.GITHUB_EVENT_PATH, "utf8"));
  const verifying = mode.startsWith("--verify-");
  if (verifying && !positive(environment.CI_EVIDENCE_PRODUCER_ATTEMPT))
    throw new Error("Analysis requires the successful producer attempt output");
  if (!verifying && !output && !environment.GITHUB_OUTPUT)
    throw new Error("GITHUB_OUTPUT is required to publish coverage evidence");
  const identity = sourceIdentity({
    environment,
    event: payload,
    git: readGit,
    producerAttempt: verifying
      ? environment.CI_EVIDENCE_PRODUCER_ATTEMPT
      : undefined,
  });
  const options = { environment, output };
  if (build) {
    const expected = await buildEvidence(root, identity, environment);
    const { filename } = await regularFile(root, buildManifest, !verifying);
    if (verifying)
      await verifyManifest(root, buildManifest, expected, 1024 * 1024);
    else await publishEvidence(filename, expected, options);
    return identity;
  }
  await runCoverageEvidence({
    root,
    suite,
    platform,
    identity,
    verifying,
    options,
  });
  return identity;
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 3)
      throw new Error("Exactly one evidence mode is required");
    await runEvidence(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
