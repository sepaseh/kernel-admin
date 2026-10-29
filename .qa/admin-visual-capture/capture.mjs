import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { release } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const product = path.join(root, "coverage/qa-transport/product");
const evidence = path.join(root, "coverage/qa-visual");
const pending = path.join(evidence, "pending");
const plan = JSON.parse(
  await readFile(new URL("./plan.json", import.meta.url), "utf8"),
);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (filename, value, flag = "w") =>
  writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, { flag });
const git = async (...args) =>
  (
    await execute("git", ["-C", root, ...args], {
      encoding: "buffer",
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    })
  ).stdout;
const gitText = async (...args) => (await git(...args)).toString("utf8").trim();
const nulPaths = (bytes) => bytes.toString("utf8").split("\0").filter(Boolean);

export function transformCanonicalSpec(source) {
  if (
    (source.match(/await expect\(page\)\.toHaveScreenshot\(/g) ?? []).length !==
    4
  )
    throw new Error(
      "The reviewed canonical six-scenario source changed; re-review the adapter.",
    );
  return (
    'import { capturePending } from "./capture-pending";\n' +
    source
      .replace(
        '"../shared/admin-fixtures"',
        '"../../coverage/qa-transport/product/e2e/shared/admin-fixtures"',
      )
      .replace(
        '"./readiness"',
        '"../../coverage/qa-transport/product/e2e/visual/readiness"',
      )
      .replaceAll(
        "await expect(page).toHaveScreenshot(",
        "await capturePending(page, ",
      )
  );
}

export function assertTransportAuthorization(configuration = plan) {
  if (configuration?.status !== "AUTHORIZED_BOUNDED_QA")
    throw new Error(
      "The bounded QA transport must have explicit recorded authorization.",
    );
}

export function assertRuntime(environment = process.env) {
  assertTransportAuthorization();
  if (
    environment.CI !== "true" ||
    environment.GITHUB_ACTIONS !== "true" ||
    environment.GITHUB_REPOSITORY !== plan.repository ||
    environment.GITHUB_REF !== `refs/heads/${plan.branch}` ||
    environment.RUNNER_OS !== "Windows" ||
    process.platform !== "win32" ||
    process.arch !== "x64" ||
    process.version !== plan.node ||
    !/^[a-f0-9]{40}$/.test(plan.productTree) ||
    !/^[a-f0-9]{40}$/.test(plan.baseCommit) ||
    !["capture", "verify"].includes(plan.mode)
  )
    throw new Error(
      "The explicit Windows QA transport/runtime identity is required.",
    );
}

export function assertHumanApproval(approval, names = plan.images) {
  if (
    approval?.approvedAllSix !== true ||
    typeof approval.reviewer !== "string" ||
    !approval.reviewer.trim() ||
    !Number.isFinite(Date.parse(approval.reviewedAt)) ||
    typeof approval.evidence !== "string" ||
    !approval.evidence.trim() ||
    !/^[a-f0-9]{40}$/.test(approval.captureCommit ?? "") ||
    !/^\d+$/.test(approval.captureRunId ?? "") ||
    !/^\d+$/.test(approval.captureRunAttempt ?? "") ||
    !/^\d+$/.test(approval.captureArtifactId ?? "") ||
    !/^sha256:[a-f0-9]{64}$/.test(approval.captureArtifactDigest ?? "") ||
    !/^[a-f0-9]{64}$/.test(approval.capturedMetadataSha256 ?? "") ||
    !/^[a-f0-9]{64}$/.test(approval.approvedMetadataSha256 ?? "") ||
    !isDeepStrictEqual(
      Object.keys(approval.images ?? {}).sort(),
      [...names].sort(),
    ) ||
    !Object.values(approval.images).every((value) =>
      /^[a-f0-9]{64}$/.test(value),
    )
  )
    throw new Error(
      "Separate explicit human approval of all six exact CI images is required.",
    );
}

export function assertArtifactIdentity(approval, artifact, run) {
  if (
    artifact.expired !== false ||
    String(artifact.id) !== approval.captureArtifactId ||
    artifact.digest !== approval.captureArtifactDigest ||
    String(artifact.workflow_run?.id) !== approval.captureRunId ||
    artifact.workflow_run?.head_sha !== approval.captureCommit ||
    String(run.id) !== approval.captureRunId ||
    String(run.run_attempt) !== approval.captureRunAttempt ||
    run.head_sha !== approval.captureCommit ||
    run.head_branch !== plan.branch ||
    run.event !== "push" ||
    run.status !== "completed" ||
    run.conclusion !== "success"
  )
    throw new Error(
      "Actual immutable artifact digest and successful capture run/head must match the approved evidence.",
    );
}

async function readCaptureArtifactIdentity(approval) {
  const token = process.env.GITHUB_TOKEN;
  if (!token)
    throw new Error(
      "The read-only Actions token is required to verify prior artifact identity.",
    );
  const get = async (suffix) => {
    const response = await fetch(
      `https://api.github.com/repos/${plan.repository}/actions/${suffix}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        redirect: "error",
      },
    );
    if (!response.ok)
      throw new Error(
        `Read-only capture evidence request failed: HTTP ${response.status}.`,
      );
    return response.json();
  };
  const [artifact, run] = await Promise.all([
    get(`artifacts/${approval.captureArtifactId}`),
    get(`runs/${approval.captureRunId}/attempts/${approval.captureRunAttempt}`),
  ]);
  assertArtifactIdentity(approval, artifact, run);
  return {
    artifactId: artifact.id,
    artifactName: artifact.name,
    digest: artifact.digest,
    runId: run.id,
    attempt: run.run_attempt,
    head: run.head_sha,
    conclusion: run.conclusion,
    url: run.html_url,
  };
}

export function parseTree(bytes) {
  const files = nulPaths(bytes).map((record) => {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(record);
    if (
      !match ||
      /[\\:\0\r\n]/.test(match[3]) ||
      match[3].split("/").some((part) => !part || part === "." || part === "..")
    )
      throw new Error("Only ordinary safe public Git blobs may be exported.");
    return { mode: match[1], blob: match[2], path: match[3] };
  });
  if (
    new Set(files.map((file) => file.path.toLowerCase())).size !== files.length
  )
    throw new Error("Case-colliding product paths are forbidden.");
  return files;
}

export async function collectImages(directory, names = plan.images) {
  const actual = (await readdir(directory))
    .filter((name) => name !== "metadata.json")
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify([...names].sort()))
    throw new Error("All and only the six pending images must exist.");
  return Promise.all(
    names.map(async (name) => {
      const bytes = await readFile(path.join(directory, name));
      if (
        bytes.length < 24 ||
        bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
      )
        throw new Error(`Pending image ${name} is not PNG data.`);
      return {
        name,
        sha256: sha256(bytes),
        bytes: bytes.length,
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
      };
    }),
  );
}

async function prepare() {
  assertRuntime();
  const captureCommit = await gitText("rev-parse", "HEAD");
  if (captureCommit !== process.env.GITHUB_SHA)
    throw new Error("QA head does not match the workflow event.");
  const productCommit = await gitText(
    "show",
    "-s",
    "--format=%P",
    captureCommit,
  );
  const parent = await gitText("show", "-s", "--format=%P", productCommit);
  const baseCommit = plan.baseCommit;
  let priorCaptureCommit = null;
  let priorProductCommit = null;
  let captureArtifactEvidence = null;
  if (plan.mode === "capture") {
    if (parent !== baseCommit || plan.productTree !== plan.initialProductTree)
      throw new Error(
        "Initial capture transport must descend directly from its reviewed base.",
      );
  } else {
    assertHumanApproval(plan.approval);
    priorCaptureCommit = parent;
    priorProductCommit = await gitText(
      "show",
      "-s",
      "--format=%P",
      priorCaptureCommit,
    );
    if (
      priorCaptureCommit !== plan.approval.captureCommit ||
      (await gitText("show", "-s", "--format=%P", priorProductCommit)) !==
        baseCommit ||
      (await gitText("rev-parse", `${priorProductCommit}^{tree}`)) !==
        plan.initialProductTree
    )
      throw new Error(
        "Verification must append to the actual first capture's two-commit history.",
      );
    const before = JSON.parse(
      await gitText(
        "show",
        `${priorCaptureCommit}:.qa/admin-visual-capture/plan.json`,
      ),
    );
    if (
      before.mode !== "capture" ||
      before.productTree !== plan.initialProductTree
    )
      throw new Error(
        "The prior QA commit was not the reviewed pending capture transport.",
      );
    captureArtifactEvidence = await readCaptureArtifactIdentity(plan.approval);
    const baselinePaths = new Set(
      [...plan.images, "metadata.json"].map(
        (name) => `e2e/visual/baselines/application/win32/${name}`,
      ),
    );
    const productChanges = nulPaths(
      await git(
        "diff",
        "--no-renames",
        "--name-only",
        "-z",
        priorProductCommit,
        productCommit,
      ),
    );
    if (
      !productChanges.length ||
      productChanges.some((file) => !baselinePaths.has(file))
    )
      throw new Error(
        "Follow-up product transport may change only the approved baseline images and metadata.",
      );
  }
  if (
    !/^[a-f0-9]{40}$/.test(productCommit) ||
    (await gitText("rev-parse", `${productCommit}^{tree}`)) !== plan.productTree
  )
    throw new Error(
      "The transported product tree differs from the concrete reviewed tree.",
    );
  const helperChanges = nulPaths(
    await git(
      "diff",
      "--no-renames",
      "--name-only",
      "-z",
      productCommit,
      captureCommit,
    ),
  ).sort();
  const helperAdditions = nulPaths(
    await git(
      "diff",
      "--no-renames",
      "--diff-filter=A",
      "--name-only",
      "-z",
      productCommit,
      captureCommit,
    ),
  ).sort();
  const expectedHelpers = [...plan.helpers].sort();
  if (
    JSON.stringify(helperChanges) !== JSON.stringify(expectedHelpers) ||
    JSON.stringify(helperAdditions) !== JSON.stringify(expectedHelpers)
  )
    throw new Error(
      "The second transport commit may only add the six reviewed QA files.",
    );
  const changedPaths = nulPaths(
    await git(
      "diff",
      "--no-renames",
      "--name-only",
      "-z",
      baseCommit,
      productCommit,
    ),
  );
  const files = parseTree(
    await git("ls-tree", "-r", "-z", "--full-tree", productCommit),
  );
  if (
    files.length !== plan.productFiles ||
    changedPaths.length !== plan.changedFiles ||
    changedPaths.length > 100
  )
    throw new Error(
      "Product raw inventory or actual changed-file count differs from the reviewed scope.",
    );
  await mkdir(path.dirname(product), { recursive: true });
  await mkdir(product);
  await mkdir(pending, { recursive: true });
  const rawFiles = [];
  for (const file of files) {
    const bytes = await git("cat-file", "blob", file.blob);
    const target = path.join(product, file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
    rawFiles.push({ ...file, sha256: sha256(bytes), bytes: bytes.length });
  }
  const canonical = await readFile(
    path.join(product, "e2e/visual/admin.spec.ts"),
    "utf8",
  );
  if (
    (await readFile(
      new URL("./admin.capture.spec.ts", import.meta.url),
      "utf8",
    )) !== transformCanonicalSpec(canonical)
  )
    throw new Error(
      "Capture spec does not preserve the exact canonical scenario bodies.",
    );
  const { fingerprintVisualSources } = await import(
    pathToFileURL(path.join(product, "scripts/run-visual.mjs"))
  );
  const source = await fingerprintVisualSources(product);
  if (
    source.sourceFingerprint !== plan.sourceFingerprint ||
    source.sourceInputs.length !== plan.sourceInputs
  )
    throw new Error(
      "Exported product visual source does not match the reviewed frozen source.",
    );
  const transport = {
    status: "prepared",
    productTree: plan.productTree,
    productCommit,
    baseCommit,
    captureCommit,
    priorCaptureCommit,
    priorProductCommit,
    captureArtifactEvidence,
    mode: plan.mode,
    productFiles: files.length,
    changedFiles: changedPaths.length,
    changedPaths,
    rawFiles,
    canonicalSpecSha256: sha256(Buffer.from(canonical)),
    ...source,
  };
  await json(
    path.join(evidence, "product-tree-evidence.json"),
    transport,
    "wx",
  );
  if (process.env.GITHUB_OUTPUT)
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `mode=${plan.mode}\ncapture_artifact_id=${plan.approval?.captureArtifactId ?? ""}\ncapture_run_id=${plan.approval?.captureRunId ?? ""}\n`,
    );
  console.info(
    `Prepared exact raw product tree ${plan.productTree}; ${files.length} files, ${changedPaths.length} actual changes.`,
  );
}

async function verify() {
  assertRuntime();
  assertHumanApproval(plan.approval);
  const transport = JSON.parse(
    await readFile(path.join(evidence, "product-tree-evidence.json"), "utf8"),
  );
  if (
    plan.mode !== "verify" ||
    transport.mode !== "verify" ||
    transport.productTree !== plan.productTree ||
    transport.captureCommit !== process.env.GITHUB_SHA
  )
    throw new Error(
      "Only the separately approved verification transport can run the full profile.",
    );
  const capturedDirectory = path.join(evidence, "captured/pending");
  const capturedBytes = await readFile(
    path.join(capturedDirectory, "metadata.json"),
  );
  const captured = JSON.parse(capturedBytes);
  const baseline = path.join(product, "e2e/visual/baselines/application/win32");
  const approvedBytes = await readFile(path.join(baseline, "metadata.json"));
  const approved = JSON.parse(approvedBytes);
  const approval = plan.approval;
  if (
    sha256(capturedBytes) !== approval.capturedMetadataSha256 ||
    sha256(approvedBytes) !== approval.approvedMetadataSha256 ||
    captured.status !== "complete-pending-human-review" ||
    captured.review?.status !== "pending" ||
    captured.captureCommit !== transport.priorCaptureCommit ||
    captured.captureCommit !== approval.captureCommit ||
    String(captured.workflow?.runId) !== approval.captureRunId ||
    String(captured.workflow?.attempt) !== approval.captureRunAttempt ||
    captured.sourceExport?.productTree !== plan.initialProductTree ||
    captured.sourceExport?.productCommit !== transport.priorProductCommit ||
    !Number.isFinite(Date.parse(captured.completedAt)) ||
    Date.parse(approval.reviewedAt) < Date.parse(captured.completedAt) ||
    Date.parse(approval.reviewedAt) > Date.now() ||
    !isDeepStrictEqual(approved, {
      ...captured,
      review: {
        status: "reviewed",
        reviewer: approval.reviewer,
        reviewedAt: approval.reviewedAt,
      },
    })
  )
    throw new Error(
      "Approved metadata must preserve the actual CI capture with only the explicit human review field changed.",
    );
  const capturedImages = await collectImages(capturedDirectory);
  const approvedImages = await collectImages(baseline);
  if (
    !isDeepStrictEqual(capturedImages, captured.images) ||
    !isDeepStrictEqual(capturedImages, approvedImages) ||
    capturedImages.some((image) => image.sha256 !== approval.images[image.name])
  )
    throw new Error(
      "Every approved image must be byte-identical to its actual CI artifact and human-approved SHA256.",
    );
  const require = createRequire(path.join(product, "package.json"));
  const installed = require("@playwright/test/package.json").version;
  const lock = JSON.parse(
    await readFile(path.join(product, "package-lock.json"), "utf8"),
  );
  if (
    installed !== plan.playwright ||
    installed !== lock.packages["node_modules/@playwright/test"].version
  )
    throw new Error(
      "Full verification must use the reviewed locked Playwright installation.",
    );
  const { chromium } = require("@playwright/test");
  const {
    assertReviewedVisualBaseline,
    inspectVisualBrowser,
    visualEnvironment,
  } = await import(
    pathToFileURL(path.join(product, "scripts/visual-environment.mjs"))
  );
  const { fingerprintVisualSources, runVisualChild } = await import(
    pathToFileURL(path.join(product, "scripts/run-visual.mjs"))
  );
  const runtimeEnvironment = { ...visualEnvironment(process.env), CI: "true" };
  const browserVersion = await inspectVisualBrowser(
    (env) =>
      chromium.launch({
        executablePath: chromium.executablePath(),
        headless: true,
        env,
      }),
    runtimeEnvironment,
  );
  assertReviewedVisualBaseline(approved, {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    osRelease: release(),
    playwright: installed,
    browserVersion,
    strictProvenance: true,
  });
  const source = await fingerprintVisualSources(product);
  if (
    source.sourceFingerprint !== plan.sourceFingerprint ||
    !isDeepStrictEqual(source.sourceInputs, approved.sourceInputs) ||
    approved.sourceFingerprint !== source.sourceFingerprint
  )
    throw new Error(
      "Human-reviewed captures must match the transported source inputs.",
    );
  const manifest = JSON.parse(
    await readFile(path.join(product, ".agents/validation.json"), "utf8"),
  );
  if (
    manifest.profiles.full.length !== 19 ||
    manifest.profiles.full.some(
      (id) =>
        manifest.checks.find((check) => check.id === id)?.kind !== "required",
    )
  )
    throw new Error(
      "The unchanged canonical nineteen-check required full profile is mandatory.",
    );
  const npm = path.join(
    path.dirname(process.execPath),
    "node_modules/npm/bin/npm-cli.js",
  );
  const environment = {
    ...runtimeEnvironment,
    npm_execpath: npm,
    VITE_RELEASE_ID: "application-verification",
  };
  delete environment.NODE_ENV;
  delete environment.KERNEL_VISUAL_RUNNER;
  const result = {
    productTree: transport.productTree,
    productCommit: transport.productCommit,
    captureCommit: transport.captureCommit,
    originalCaptureCommit: captured.captureCommit,
    approval,
    canonicalCommand: "npm run validate -- full",
    profile: manifest.profiles.full,
    runtime: {
      platform: process.platform,
      arch: process.arch,
      osRelease: release(),
      node: process.version,
      playwright: installed,
      browserVersion,
    },
    status: "running",
    fullGatePassed: false,
    workflowRun: `https://github.com/${plan.repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  };
  await json(path.join(evidence, "canonical-full-result.json"), result, "wx");
  const exitCode = await runVisualChild({
    command: process.execPath,
    args: [npm, "run", "validate", "--", "full"],
    cwd: product,
    environment,
  });
  for (const file of transport.rawFiles)
    if (sha256(await readFile(path.join(product, file.path))) !== file.sha256)
      throw new Error(
        `Raw approved product source changed during verification: ${file.path}`,
      );
  result.status = exitCode === 0 ? "passed" : "failed";
  result.exitCode = exitCode;
  result.fullGatePassed = exitCode === 0;
  result.completedAt = new Date().toISOString();
  await json(path.join(evidence, "canonical-full-result.json"), result);
  if (exitCode !== 0)
    throw new Error(`The canonical full profile failed with exit ${exitCode}.`);
}

async function capture() {
  assertRuntime();
  const transport = JSON.parse(
    await readFile(path.join(evidence, "product-tree-evidence.json"), "utf8"),
  );
  if (
    transport.productTree !== plan.productTree ||
    transport.captureCommit !== process.env.GITHUB_SHA
  )
    throw new Error("Prepared product transport identity changed.");
  const require = createRequire(path.join(product, "package.json"));
  const lock = JSON.parse(
    await readFile(path.join(product, "package-lock.json"), "utf8"),
  );
  const installed = require("@playwright/test/package.json").version;
  if (
    installed !== plan.playwright ||
    installed !== lock.packages["node_modules/@playwright/test"].version ||
    (await readFile(path.join(product, ".nvmrc"), "utf8")).trim() !==
      plan.node.slice(1)
  )
    throw new Error(
      "Actual Node/Playwright must match the locked reviewed versions.",
    );
  const { chromium } = require("@playwright/test");
  const { runVisualChild } = await import(
    pathToFileURL(path.join(product, "scripts/run-visual.mjs"))
  );
  const {
    acquireVisualLock,
    assertVisualPortsAvailable,
    inspectVisualBrowser,
    visualEnvironment,
  } = await import(
    pathToFileURL(path.join(product, "scripts/visual-environment.mjs"))
  );
  const environment = {
    ...visualEnvironment(process.env),
    CI: "true",
    KERNEL_QA_CAPTURE: "1",
  };
  const metadataFile = path.join(pending, "metadata.json");
  const metadata = {
    platform: process.platform,
    arch: process.arch,
    osRelease: release(),
    node: process.version,
    playwright: installed,
    browser: "bundled-chromium",
    browserVersion: null,
    sourceFingerprint: transport.sourceFingerprint,
    sourceInputs: transport.sourceInputs,
    sourceExport: {
      productTree: transport.productTree,
      productCommit: transport.productCommit,
      baseCommit: transport.baseCommit,
      productFiles: transport.productFiles,
      changedFiles: transport.changedFiles,
    },
    generatedAt: new Date().toISOString(),
    captureCommit: transport.captureCommit,
    workflow: {
      runId: process.env.GITHUB_RUN_ID,
      attempt: process.env.GITHUB_RUN_ATTEMPT,
      url: `https://github.com/${plan.repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      ref: process.env.GITHUB_WORKFLOW_REF,
      runnerOS: process.env.RUNNER_OS,
      imageOS: process.env.ImageOS ?? null,
      imageVersion: process.env.ImageVersion ?? null,
    },
    review: { status: "pending", reviewer: null, reviewedAt: null },
    captureOnly: true,
    canonicalVisualComparison: false,
    fullGatePassed: false,
    status: "pending",
  };
  await json(metadataFile, metadata, "wx");
  const releaseLock = await acquireVisualLock(path.join(evidence, "lock"));
  try {
    await assertVisualPortsAvailable();
    metadata.browserVersion = await inspectVisualBrowser(
      (env) =>
        chromium.launch({
          executablePath: chromium.executablePath(),
          headless: true,
          env,
        }),
      environment,
    );
    if (metadata.browserVersion !== plan.expectedBundledChromium)
      throw new Error(
        "Actual bundled Chromium differs from the reviewed pinned runtime.",
      );
    metadata.status = "capturing";
    await json(metadataFile, metadata);
    const code = await runVisualChild({
      command: process.execPath,
      args: [
        require.resolve("@playwright/test/cli"),
        "test",
        "--config",
        path.join(
          root,
          ".qa/admin-visual-capture/playwright.capture.config.ts",
        ),
      ],
      environment,
      cwd: product,
    });
    if (code !== 0)
      throw new Error(`Capture-only fixtures failed with exit ${code}.`);
    metadata.images = await collectImages(pending);
    for (const file of transport.rawFiles)
      if (sha256(await readFile(path.join(product, file.path))) !== file.sha256)
        throw new Error(
          `Raw product source changed during capture: ${file.path}`,
        );
    metadata.status = "complete-pending-human-review";
    metadata.completedAt = new Date().toISOString();
    await json(metadataFile, metadata);
    console.info(
      "All six captures are complete and pending; no baseline was approved or promoted.",
    );
  } catch (error) {
    metadata.status = "failed-pending-human-review";
    metadata.failure = String(error.message ?? error);
    await json(metadataFile, metadata);
    throw error;
  } finally {
    await releaseLock();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (
      process.argv.length !== 3 ||
      !["prepare", "execute"].includes(process.argv[2])
    )
      throw new Error(
        "Use only prepare or execute; baseline update commands are forbidden.",
      );
    if (process.argv[2] === "prepare") await prepare();
    else if (plan.mode === "capture") await capture();
    else await verify();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
