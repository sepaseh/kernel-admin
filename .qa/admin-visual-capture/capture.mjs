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


export const repairBinding = Object.freeze({
  "failedQaCommit": "f879b5545b866ebbf4955005e45cc5276c7fd0b7",
  "failedProductCommit": "32efe6ad153cd2d8f30e4f3b909d9aafd4dbd5ec",
  "failedProductTree": "dc763dd12f80463881f2b29cc7a689468dcc01a2",
  "failedQaTree": "b564ab69d4a5f18afb9ef20d23a87a8a3476596a",
  "failedRunId": "41005499891",
  "failedRunAttempt": "1",
  "originalCaptureCommit": "2348367edd25eb764658b62bc5ab128def4dc029",
  "originalProductCommit": "c4cec0fe4960ac89d1b9f89c29c4b551f9902041",
  "baseCommit": "d7e84a22d848c1b605e7b1a34afb4968e4f73cc9",
  "baselineSourceFingerprint": "532457f25918ee9b74f5a7ec65a081b6c91b24bf2729cb813e2ffcdc355e2eed",
  "inheritedPerformanceRepair": {
    "failedQaCommit": "962a55bcc52e51f3489d344355e852a206424a00",
    "failedProductCommit": "fdba0dcca5b792b1cdd87499f89303c00effc29b",
    "failedProductTree": "c716e37c6ddd6cac78b921b9037857f25b34f58b",
    "failedQaTree": "cd0813cfc5942dbf500c451d7fc8e1b2fafcd029",
    "failedRunId": "40946286573",
    "failedRunAttempt": "1",
    "originalCaptureCommit": "2348367edd25eb764658b62bc5ab128def4dc029",
    "originalProductCommit": "c4cec0fe4960ac89d1b9f89c29c4b551f9902041",
    "approvedProductCommit": "04c35d27f8922d009bf8b87f4f47a280bc262fa4",
    "priorFailedQaCommit": "0a6bce9cab23f8f99b21a1217b7c234927ea1fd5",
    "baseCommit": "d7e84a22d848c1b605e7b1a34afb4968e4f73cc9",
    "baselineSourceFingerprint": "532457f25918ee9b74f5a7ec65a081b6c91b24bf2729cb813e2ffcdc355e2eed",
    "inheritedFixtureRepair": {
      "failedQaCommit": "0a6bce9cab23f8f99b21a1217b7c234927ea1fd5",
      "failedProductCommit": "04c35d27f8922d009bf8b87f4f47a280bc262fa4",
      "failedProductTree": "00c2b2a9a52bdcdb7f8d52bf7a25564cfcbdca8c",
      "failedRunId": "40943400376",
      "failedRunAttempt": "1",
      "originalCaptureCommit": "2348367edd25eb764658b62bc5ab128def4dc029",
      "originalProductCommit": "c4cec0fe4960ac89d1b9f89c29c4b551f9902041",
      "baseCommit": "d7e84a22d848c1b605e7b1a34afb4968e4f73cc9",
      "repairedProductTree": "c716e37c6ddd6cac78b921b9037857f25b34f58b",
      "files": [
        {
          "path": "docs/testing.fa.md",
          "beforeSha256": "460537c368e85aaf05df33ab43850a5238de4466167ba7ad25fa693eb96f59ee",
          "afterSha256": "e66ac049d22d861ab1b667d179b99cd7a4d7d49df97c0f02bd50f2f1bed1432d"
        },
        {
          "path": "docs/testing.md",
          "beforeSha256": "51fbd3c01785a4cbc27b1698773a43cc3dc8b28db24a836926ba4105c9fe4fc2",
          "afterSha256": "1f175943674faa443f88bbb5372f31c9fb556c301ca684797ebe04496968eebd"
        },
        {
          "path": "scripts/package-release.test.mjs",
          "beforeSha256": "91bb4f192c418ca90dccd21d8ebe57af7b4bc266555ae4b8c12e9cbf655d1523",
          "afterSha256": "9970b4a58b565b88c95894cb5956e8d75a4efb24923a7fded76e52ebdb5215bd"
        },
        {
          "path": "scripts/run-lighthouse.test.mjs",
          "beforeSha256": "8d9ca81c741d31691dab19bd0e0fdce4a76552ff2e753a6d75deb4b1a0a39b09",
          "afterSha256": "0ac75e61e9f1d9d2746ca35983f8b9028e34c0c660a08c004eb01e0289513885"
        }
      ]
    },
    "repairedProductTree": "dc763dd12f80463881f2b29cc7a689468dcc01a2",
    "files": [
      {
        "path": "docs/testing.fa.md",
        "beforeSha256": "e66ac049d22d861ab1b667d179b99cd7a4d7d49df97c0f02bd50f2f1bed1432d",
        "afterSha256": "d7880ec01da68b3d2078ddb20491b78c6997a500248037addc9ca5491969fd97"
      },
      {
        "path": "docs/testing.md",
        "beforeSha256": "1f175943674faa443f88bbb5372f31c9fb556c301ca684797ebe04496968eebd",
        "afterSha256": "ed2eddcfd22573c655ca80e230c473da34ca19464d08a667255d6b781d98ac96"
      },
      {
        "path": "src/app/App.tsx",
        "beforeSha256": "c8f45e0b185cd336d9d1f7d6d72343e846cdc990eebb0e94e857cf6f23bc077c",
        "afterSha256": "8a3793896963ce936c19874e70bb549a1114a7f28000ea893c8fde61632031b1"
      },
      {
        "path": "src/app/Routes.test.tsx",
        "beforeSha256": "4de51b2de2b50f561fa2982b4d921e358cd4f5c6bcc28bb91e4632a850124262",
        "afterSha256": "3d37fab6374819e656a1cc90f6513c6308f36ecbac1cbab3ace5dddb322bb31c"
      },
      {
        "path": "vite.config.ts",
        "beforeSha256": "5445a056165ef9aaed263a33117ad8525f964a2bce95cc5676f7fe06783d9ef4",
        "afterSha256": "88140888a95ab6d5a279d2f302e6908afcbaa031a4c0ff75c610f5054aeb856e"
      }
    ]
  },
  "repairedProductTree": "908364418efdb50a930e1431ebd1cb0312c51c1a",
  "candidateChangedFiles": 98,
  "files": [
    {
      "path": ".agents/README.md",
      "beforeSha256": "0bb0ba558fc6abaa45474b7478eb039607d2deaf0abc1e0655ad44251e220ad0",
      "afterSha256": "a105b50e118135993bd825805a2fa942107407443ab7e0f4a463bf985e3992cb"
    },
    {
      "path": ".agents/rules/testing.md",
      "beforeSha256": "ea895094160aa24acab169649c3d60343c090dddbd5191a174d344b9bf62f1e0",
      "afterSha256": "59fe65341c36cefa38c4e486ca9490b082f1ba0d865deef8a2278438e8af79b5"
    },
    {
      "path": "CONTRIBUTING.fa.md",
      "beforeSha256": "183d0868b20e852dfc66c23a2dea8422ae996a142e954688942973884e62a030",
      "afterSha256": "2170da286d09a70f701015436d5e0fb5075c44db652636689931e1b85d2d6336"
    },
    {
      "path": "CONTRIBUTING.md",
      "beforeSha256": "d6f953ff4e525eced5edfeb6f975cdaeaf5933698ff258adf7f20b0156812135",
      "afterSha256": "7ac83367ae1df290b8a2ff9aed7c5f6da6b641c8c3b69056857d29866585b2a6"
    },
    {
      "path": "README.fa.md",
      "beforeSha256": "424c48088cd24da09725c75bd30c3957b27adfe1a15883f996c33e50d8ada82e",
      "afterSha256": "1e2abb99e1decc90ba1c52c484f1edbb720010d45fe797f6cca8732ff8d8274c"
    },
    {
      "path": "README.md",
      "beforeSha256": "87427306a5b8afe1aff211a1a0e8feba4e721c7a6ee4080ebd0a895f0c1a1085",
      "afterSha256": "69702e6df8d1193a96ae9e8dc0a28ea1bd683fd8e0c3aa162bf82ca35cb9e384"
    },
    {
      "path": "docs/bootstrap.fa.md",
      "beforeSha256": "9a66b880fb02ffda04694ec68c16e4a4f6a01b779592f8d31d05ce2cbddab4fa",
      "afterSha256": "f5df6fd959d15f6676df0b89b5b10b17633b06e3e34f7fdd88c87a3cc392023f"
    },
    {
      "path": "docs/bootstrap.md",
      "beforeSha256": "456d2cb04bba412172e03ce0b4e8d457efeb60ae6822d8a67d07b95a76da85c3",
      "afterSha256": "7ed0c645fe14ad051542087c3ca9aef1700fec453006994f5502c7c8734b8d1c"
    },
    {
      "path": "docs/branch-protection.fa.md",
      "beforeSha256": "10ec820c98cd9a5aea70b3f44b5d189dd4d520b83b211b6b2737296d2a91027f",
      "afterSha256": "f5d57e3a30f29be2e2d192ec98f49ba69761c3bbe96efb04dfed60e066f6f182"
    },
    {
      "path": "docs/branch-protection.md",
      "beforeSha256": "33ce6e5ac8a838b9c3035b18acfb9bfc69500c5c0de673b72fc506656323a946",
      "afterSha256": "4f040bbbee2756bea7823a442ede8d6fe311d58a78d0e1872e7fe1c3bb243e9b"
    },
    {
      "path": "docs/component-coverage.fa.md",
      "beforeSha256": "17c8a821323d64a752b521f09cbb727e8f0750c7e54b3be90ab226aa40750a12",
      "afterSha256": "45849f2adc182fb1df939e32484eb166441082d10ac1e314abb82268dcb61833"
    },
    {
      "path": "docs/component-coverage.md",
      "beforeSha256": "2e27a6d0bdfb657b3c9b7bcf495dd9857303a6b96a25d5410d1d29965cdaf147",
      "afterSha256": "8d0d2f32a8c17bb061af1f927528aa60bb835c8b5c08dabb0ab7a7f0e46e5a75"
    },
    {
      "path": "docs/contract-testing.fa.md",
      "beforeSha256": "dc6ecdbf19f8935184933f00507226419e7a5f653cd803a9828c4029b7b89807",
      "afterSha256": "f3cc646101b956bf1bdf0e3ee5cffc7fd220634edde05656dd9e9b3ed9c44d92"
    },
    {
      "path": "docs/contract-testing.md",
      "beforeSha256": "0415c797c266367561b336d1ce96bf144c718242e8d5c744ee620443a6c26c21",
      "afterSha256": "e8d41ccb9c9a80154a68cece2a2b1d3ac133b25654a1e20369567f4bb05549d8"
    },
    {
      "path": "docs/sonarqube.fa.md",
      "beforeSha256": "3820afc60c22a7afbc299af50679c7ddee5373c4652b611cfb024d3607ec9c0f",
      "afterSha256": "a2be65087fce7395eed6927173072c187251e8398ae7885edc77915a350afc5f"
    },
    {
      "path": "docs/sonarqube.md",
      "beforeSha256": "dd36db0133273dec2e365cc6c3fdd2ba179e6dc13b2742cac515e38db489423a",
      "afterSha256": "53d82c67a4cfe6f807eaa0833be03b6d9fee23d7c45d26cc5f82d78d79d785fd"
    },
    {
      "path": "docs/source-navigation.fa.md",
      "beforeSha256": "925f92f9c3b2ce2bd4be497685a3dfb7e0b08ec21c1d2d76d708b6bbb0bb0276",
      "afterSha256": "cd90e360599286c6047fd5548a32f5ac34774e29b6b93a13c8c9009d6f27b39f"
    },
    {
      "path": "docs/source-navigation.md",
      "beforeSha256": "6caafb6fcfa526f04b8aa414464b92401a13c7f17bdaf8f12c7fee8aecf4e8d3",
      "afterSha256": "b44ea37c7dbf20e84b50b2821dd0b0052edc7e8911f9f576c48f216103276a1d"
    },
    {
      "path": "docs/testing.fa.md",
      "beforeSha256": "d7880ec01da68b3d2078ddb20491b78c6997a500248037addc9ca5491969fd97",
      "afterSha256": "5503db2fdc4cd7f717662c58dc3a9f0a37b88cb40b34fe5ce31329ec7d072a4a"
    },
    {
      "path": "docs/testing.md",
      "beforeSha256": "ed2eddcfd22573c655ca80e230c473da34ca19464d08a667255d6b781d98ac96",
      "afterSha256": "9aa3198eb3463450c413e5f5f98964b079b955b62fef89b8673db156bc1495b6"
    },
    {
      "path": "docs/validation.fa.md",
      "beforeSha256": "79a4513850a0ae49d0e3d562edda87ef4ed568649d199bf813c20424b632a5a3",
      "afterSha256": "fc4c8a91ca56635bc5715a9d15b45858804868fad7bd9f25a1bc268a06aa4471"
    },
    {
      "path": "docs/validation.md",
      "beforeSha256": "057ae2b14eb68141de16a813bed0fb93c01782af4504265c81ee8df30a560e8a",
      "afterSha256": "5e59f54fb2c5dec46da0cbd89f37e5db3bfe17a95528d3964a32446f5b8e4559"
    },
    {
      "path": "e2e/language-authority.spec.ts",
      "beforeSha256": "b28faaea30101b2a8d7159f4aa423b52fde4b7aeb6df293985905fe170660fe9",
      "afterSha256": "7d987433886203ba613bb4eddccc6e5e32bec8c7696a2c8e9e7dd16427fdff70"
    }
  ]
});
export const scopeRepairPaths = Object.freeze([
  ".agents/README.md",
  ".agents/rules/testing.md",
  "CONTRIBUTING.fa.md",
  "CONTRIBUTING.md",
  "README.fa.md",
  "README.md",
  "docs/bootstrap.fa.md",
  "docs/bootstrap.md",
  "docs/branch-protection.fa.md",
  "docs/branch-protection.md",
  "docs/component-coverage.fa.md",
  "docs/component-coverage.md",
  "docs/contract-testing.fa.md",
  "docs/contract-testing.md",
  "docs/sonarqube.fa.md",
  "docs/sonarqube.md",
  "docs/source-navigation.fa.md",
  "docs/source-navigation.md",
  "docs/testing.fa.md",
  "docs/testing.md",
  "docs/validation.fa.md",
  "docs/validation.md",
  "e2e/language-authority.spec.ts"
]);
export const diagnosticPolicy = Object.freeze({ enabled: true, commands: ["npm run build", "npm run test:lighthouse"], attemptLimit: 1, requiredBeforeFull: true, fullGateStillRequired: true, reportDirectory: "performance-diagnostic" });

export function assertRepairConfiguration(value) {
  if (
    plan.protocolVersion !== "scope-readiness-repair-v1" || plan.finalized !== true ||
    !isDeepStrictEqual(value, repairBinding) || plan.mode !== "verify" ||
    plan.productTree !== repairBinding.repairedProductTree ||
    !/^[a-f0-9]{40}$/.test(repairBinding.repairedProductTree ?? "") ||
    !Number.isSafeInteger(plan.changedFiles) || plan.changedFiles < 1 || plan.changedFiles > 100 ||
    plan.changedFiles !== repairBinding.candidateChangedFiles || plan.productFiles !== 471 || plan.sourceInputs !== 253 ||
    !/^[a-f0-9]{64}$/.test(plan.sourceFingerprint ?? "") ||
    plan.sourceFingerprint === repairBinding.baselineSourceFingerprint ||
    plan.sourceFingerprint === "f03e9473882e62280425ef37e2ef4b1e7cdda12408c8e4f2905ec359ab51fded" ||
    plan.baselineSourceFingerprint !== repairBinding.baselineSourceFingerprint ||
    !Array.isArray(repairBinding.files) || !isDeepStrictEqual(repairBinding.files.map((f) => f.path), scopeRepairPaths) ||
    !repairBinding.files.every((f) => /^[a-f0-9]{64}$/.test(f.beforeSha256) && /^[a-f0-9]{64}$/.test(f.afterSha256) && f.beforeSha256 !== f.afterSha256) ||
    !Array.isArray(plan.currentRenderingInputs) || plan.currentRenderingInputs.length !== 253 ||
    !plan.currentRenderingInputs.every((f) => typeof f.path === "string" && /^[a-f0-9]{64}$/.test(f.sha256)) ||
    new Set(plan.currentRenderingInputs.map((f) => f.path)).size !== 253 ||
    !isDeepStrictEqual(plan.currentRenderingInputs.map((f) => f.path), plan.currentRenderingInputs.map((f) => f.path).sort()) ||
    !isDeepStrictEqual(plan.performanceDiagnostic, diagnosticPolicy)
  ) throw new Error("Only the finalized exact23-path scope/readiness repair and one fixed diagnostic may append P5/Q5.");
}

export function assertFailureRecord(run, configuration) {
  if (String(run.id) !== configuration.failedRunId || String(run.run_attempt) !== configuration.failedRunAttempt ||
    run.head_sha !== configuration.failedQaCommit || run.head_branch !== plan.branch ||
    run.path !== ".github/workflows/admin-visual-capture-qa.yml" || run.repository?.full_name !== plan.repository ||
    run.event !== "push" || run.status !== "completed" || run.conclusion !== "failure")
    throw new Error("Exact actual completed failed QA run/head/attempt is mandatory.");
}
export function assertFailedRepairRun(run, configuration = plan.repair) { assertRepairConfiguration(configuration); assertFailureRecord(run, configuration); }
export function assertFailedHistory(records) {
  assertRepairConfiguration(plan.repair);
  if (!Array.isArray(records) || records.length !== 3) throw new Error("Actual distinct Q2/Q3/Q4 failure history is required.");
  const r = plan.repair, p = r.inheritedPerformanceRepair, f = p.inheritedFixtureRepair;
  for (const [index, binding] of [f, p, r].entries()) assertFailureRecord(records[index], binding);
}
const failureSummary = (run) => ({ runId: run.id, attempt: run.run_attempt, head: run.head_sha, conclusion: run.conclusion, url: run.html_url });
export function assertFailureEvidence(evidence) {
  assertRepairConfiguration(plan.repair);
  const r = plan.repair, p = r.inheritedPerformanceRepair, f = p.inheritedFixtureRepair;
  for (const [item, binding] of [[evidence, r], [evidence?.inheritedFailures?.[0], p], [evidence?.inheritedFailures?.[1], f]])
    if (!item || String(item.runId) !== binding.failedRunId || String(item.attempt) !== binding.failedRunAttempt || item.head !== binding.failedQaCommit || item.conclusion !== "failure")
      throw new Error("Prepared Q4/Q3/Q2 failure provenance changed before verification.");
  if (evidence.inheritedFailures.length !== 2) throw new Error("Exactly two inherited failed generations are required.");
}
export function parseChanges(bytes) {
  const values = nulPaths(bytes);
  if (values.length % 2) throw new Error("Malformed repair status records.");
  return Array.from({ length: values.length / 2 }, (_, i) => ({ status: values[i * 2], path: values[i * 2 + 1] }));
}
export function assertRepairChanges(fromFailed, fromInitial, configuration = plan.repair) {
  assertRepairConfiguration(configuration);
  const p = configuration.inheritedPerformanceRepair;
  const baseline = plan.images.concat("metadata.json").map((name) => "e2e/visual/baselines/application/win32/" + name);
  const expected = [...new Set(baseline.concat(p.files.map((f) => f.path), p.inheritedFixtureRepair.files.map((f) => f.path), scopeRepairPaths))].sort();
  if (fromFailed.length !== 23 || fromFailed.some((f) => f.status !== "M") || !isDeepStrictEqual(fromFailed.map((f) => f.path).sort(), scopeRepairPaths) ||
    fromInitial.length !== expected.length || fromInitial.some((f) => f.status !== "M") || !isDeepStrictEqual(fromInitial.map((f) => f.path).sort(), expected))
    throw new Error("T4 to T5 must contain only the exact23 reviewed modifications; P1 to T5 only their finite inherited repair/baseline union.");
}
export function assertRepairHashes(records, configuration = plan.repair) {
  assertRepairConfiguration(configuration);
  if (!isDeepStrictEqual(records, configuration.files)) throw new Error("Reviewed exact23 before/after hashes differ.");
}
export function assertCurrentSourceProvenance(source, approved, inputRecords) {
  assertRepairConfiguration(plan.repair);
  const names = plan.currentRenderingInputs.map((f) => f.path);
  if (source.sourceFingerprint !== plan.sourceFingerprint || !isDeepStrictEqual(source.sourceInputs, names) ||
    !isDeepStrictEqual(inputRecords, plan.currentRenderingInputs) || approved.sourceFingerprint !== plan.baselineSourceFingerprint || !isDeepStrictEqual(approved.sourceInputs, names))
    throw new Error("Current253 inputs must match the new freeze; original approved image/source provenance remains unchanged.");
}
async function readFailedRepairRun() {
  assertRepairConfiguration(plan.repair);
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Read-only Actions token required for actual Q2/Q3/Q4 failure history.");
  const r = plan.repair, p = r.inheritedPerformanceRepair, f = p.inheritedFixtureRepair;
  const records = await Promise.all([f, p, r].map(async (binding) => {
    const response = await fetch("https://api.github.com/repos/" + plan.repository + "/actions/runs/" + binding.failedRunId + "/attempts/" + binding.failedRunAttempt, {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, redirect: "error",
    });
    if (!response.ok) throw new Error("Failed QA history HTTP " + response.status);
    return response.json();
  }));
  assertFailedHistory(records);
  return { ...failureSummary(records[2]), inheritedFailures: [failureSummary(records[1]), failureSummary(records[0])] };
}

export async function runInitialPerformanceDiagnostic(runChild, runtimeEnvironment, transport) {
  assertRepairConfiguration(plan.repair);
  const directory = path.join(evidence, diagnosticPolicy.reportDirectory);
  // No recursive creation: a prior attempt or preserved output makes this fail closed.
  await mkdir(directory);
  const npm = path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  const environment = { ...runtimeEnvironment, npm_execpath: npm, VITE_RELEASE_ID: "application-verification" };
  delete environment.NODE_ENV;
  delete environment.KERNEL_VISUAL_RUNNER;
  const result = { status: "running", productTree: transport.productTree, productCommit: transport.productCommit, qaHead: transport.captureCommit, attempt: 1, commands: [], startedAt: new Date().toISOString(), fullGatePassed: false, fullGateStillRequired: true, retryAllowed: false };
  const resultFile = path.join(directory, "result.json");
  await json(resultFile, result, "wx");
  try {
    const build = await runChild({ command: process.execPath, args: [npm, "run", "build"], cwd: product, environment });
    result.commands.push({ command: diagnosticPolicy.commands[0], exitCode: build });
    if (build !== 0) throw new Error("Single initial performance build failed with exit " + build);
    const reports = path.join(product, "coverage/lighthouse");
    try { await readdir(reports); throw new Error("A pre-existing Lighthouse report forbids another diagnostic attempt."); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    const lighthouse = await runChild({ command: process.execPath, args: [npm, "run", "test:lighthouse"], cwd: product, environment });
    result.commands.push({ command: diagnosticPolicy.commands[1], exitCode: lighthouse });
    const written = await Promise.allSettled(["report.html", "report.json"].map(async (name) => {
      const bytes = await readFile(path.join(reports, name));
      await writeFile(path.join(directory, name), bytes, { flag: "wx" });
      return { name, sha256: sha256(bytes), bytes: bytes.length };
    }));
    result.reports = written.filter((x) => x.status === "fulfilled").map((x) => x.value);
    const reportFailures = written.filter((x) => x.status === "rejected").map((x) => x.reason);
    if (reportFailures.length) throw new AggregateError(reportFailures, "Single diagnostic report preservation failed.");
    const lhr = JSON.parse(await readFile(path.join(directory, "report.json"), "utf8"));
    result.totalBlockingTime = lhr.audits?.["total-blocking-time"]?.numericValue;
    result.configSettings = lhr.configSettings;
    if (lighthouse !== 0) throw new Error("Single initial Lighthouse diagnostic failed with exit " + lighthouse);
    const { evaluateLighthouseReport } = await import(pathToFileURL(path.join(product, "scripts/lighthouse-policy.mjs")));
    result.performanceScore = evaluateLighthouseReport(lhr);
    for (const file of transport.rawFiles)
      if (sha256(await readFile(path.join(product, file.path))) !== file.sha256) throw new Error("Raw source changed during initial diagnostic: " + file.path);
    result.status = "passed";
    result.exitCode = 0;
  } catch (error) {
    result.status = "failed";
    result.exitCode = 1;
    result.error = String(error.message ?? error);
    throw error;
  } finally {
    result.completedAt = new Date().toISOString();
    await json(resultFile, result);
  }
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
  let failedVerificationEvidence = null;
  if (plan.repair !== undefined) assertRepairConfiguration(plan.repair);
  if (plan.mode === "capture") {
    if (parent !== baseCommit || plan.productTree !== plan.initialProductTree)
      throw new Error(
        "Initial capture transport must descend directly from its reviewed base.",
      );
  } else {
    assertHumanApproval(plan.approval);
    if (plan.repair === undefined) {
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
    } else {
      const r = plan.repair, p = r.inheritedPerformanceRepair, f = p.inheritedFixtureRepair;
      const chain = [r.baseCommit, r.originalProductCommit, r.originalCaptureCommit, p.approvedProductCommit, p.priorFailedQaCommit, p.failedProductCommit, p.failedQaCommit, r.failedProductCommit, r.failedQaCommit, productCommit, captureCommit];
      for (let index = 1; index < chain.length; index++)
        if (await gitText("show", "-s", "--format=%P", chain[index]) !== chain[index - 1]) throw new Error("Preserve the exact B/P1/Q1/P2/Q2/P3/Q3/P4/Q4/P5/Q5 sole-parent history.");
      if (parent !== r.failedQaCommit || await gitText("rev-list", "--count", baseCommit + ".." + captureCommit) !== "10") throw new Error("Exactly ten bounded forward transport commits required.");
      for (const [commit, tree] of [[r.failedQaCommit, r.failedQaTree], [r.failedProductCommit, r.failedProductTree], [p.failedQaCommit, p.failedQaTree], [p.failedProductCommit, p.failedProductTree], [p.approvedProductCommit, f.failedProductTree], [r.originalProductCommit, plan.initialProductTree]])
        if (await gitText("rev-parse", commit + "^{tree}") !== tree) throw new Error("Preserved predecessor tree changed.");
      const failedPlan = JSON.parse(await gitText("show", r.failedQaCommit + ":.qa/admin-visual-capture/plan.json"));
      if (failedPlan.mode !== "verify" || failedPlan.productTree !== r.failedProductTree || failedPlan.sourceFingerprint !== "f03e9473882e62280425ef37e2ef4b1e7cdda12408c8e4f2905ec359ab51fded" || !isDeepStrictEqual(failedPlan.repair, p) || !isDeepStrictEqual(failedPlan.approval, plan.approval)) throw new Error("Actual Q4 plan and original Q1 human approval must remain unchanged.");
      priorCaptureCommit = r.originalCaptureCommit; priorProductCommit = r.originalProductCommit;
      failedVerificationEvidence = await readFailedRepairRun();
    }
    const before = JSON.parse(
      await gitText(
        "show",
        `${priorCaptureCommit}:.qa/admin-visual-capture/plan.json`,
      ),
    );
    if (
      before.mode !== "capture" ||
      before.productTree !== plan.initialProductTree ||
      before.sourceFingerprint !== plan.baselineSourceFingerprint ||
      before.sourceInputs !== 253
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
    if (plan.repair === undefined) {
    if (
      !productChanges.length ||
      productChanges.some((file) => !baselinePaths.has(file))
    )
      throw new Error(
        "Follow-up product transport may change only the approved baseline images and metadata.",
      );    } else {
      const r=plan.repair;
      const fromApproved=parseChanges(await git("diff","--no-renames","--name-status","-z",r.failedProductCommit,productCommit));
      const fromInitial=parseChanges(await git("diff","--no-renames","--name-status","-z",priorProductCommit,productCommit));
      assertRepairChanges(fromApproved,fromInitial);
      const hashes=[];for(const file of r.files)hashes.push({path:file.path,beforeSha256:sha256(await git("cat-file","blob",r.failedProductCommit+":"+file.path)),afterSha256:sha256(await git("cat-file","blob",productCommit+":"+file.path))});
      assertRepairHashes(hashes);
    }
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
  const currentRenderingInputs = source.sourceInputs.map((name) => {
    const file = rawFiles.find((entry) => entry.path === name);
    if (!file) throw new Error("Current rendering input is outside the exact raw product: " + name);
    return { path: name, sha256: file.sha256 };
  });
  if (!isDeepStrictEqual(currentRenderingInputs, plan.currentRenderingInputs))
    throw new Error("Every one of the current253 rendering inputs must match the reviewed freeze.");
  const originalFingerprint = createHash("sha256");
  for (const name of source.sourceInputs) {
    const bytes = await git("cat-file", "blob", priorProductCommit + ":" + name);
    originalFingerprint.update(name);
    originalFingerprint.update("\0");
    originalFingerprint.update(String(bytes.length));
    originalFingerprint.update("\0");
    originalFingerprint.update(bytes);
  }
  if (originalFingerprint.digest("hex") !== plan.baselineSourceFingerprint)
    throw new Error("Original approved capture provenance must match exact P1 raw Git sources.");
  const sourceProvenance = {
    baselineSourceFingerprint: plan.baselineSourceFingerprint,
    currentSourceFingerprint: source.sourceFingerprint,
    originalCaptureSourceCommit: priorProductCommit,
    currentSourceCommit: productCommit,
    sourceInputs: source.sourceInputs,
    currentRenderingInputs,
    comparisonRequired: true,
    newImagesApproved: false,
  };
  const transport = {
    sourceProvenance,
    status: "prepared",
    productTree: plan.productTree,
    productCommit,
    baseCommit,
    captureCommit,
    priorCaptureCommit,
    priorProductCommit,
    captureArtifactEvidence,
    failedVerificationEvidence,
    repair: plan.repair,
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
  if (plan.repair !== undefined) { assertRepairConfiguration(plan.repair); if (!isDeepStrictEqual(transport.repair, plan.repair)) throw new Error("Prepared exact23-path repair binding changed."); assertFailureEvidence(transport.failedVerificationEvidence); }
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
  const currentRenderingInputs = [];
  for (const name of source.sourceInputs)
    currentRenderingInputs.push({ path: name, sha256: sha256(await readFile(path.join(product, name))) });
  assertCurrentSourceProvenance(source, approved, currentRenderingInputs);
  if (!isDeepStrictEqual(transport.sourceProvenance?.currentRenderingInputs, currentRenderingInputs) || transport.sourceProvenance.baselineSourceFingerprint !== approved.sourceFingerprint || transport.sourceProvenance.currentSourceFingerprint !== source.sourceFingerprint)
    throw new Error("Prepared exact-source provenance changed before comparison.");
  await json(path.join(evidence, "source-provenance.json"), transport.sourceProvenance, "wx");
  await runInitialPerformanceDiagnostic(runVisualChild, runtimeEnvironment, transport);
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
