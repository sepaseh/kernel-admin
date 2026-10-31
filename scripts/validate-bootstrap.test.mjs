import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  inspectBootstrap,
  validateBootstrapPolicy,
} from "./validate-bootstrap.mjs";

const coreFiles = [
  ".github/bootstrap-policy.json",
  ".github/workflows/bootstrap.yml",
  ".github/workflows/pr-policy.yml",
  "scripts/check-pr-size.mjs",
  "scripts/check-pr-size.test.mjs",
  "scripts/validate-bootstrap.mjs",
  "scripts/validate-bootstrap.test.mjs",
];
const policy = (overrides = {}) => ({
  allowedFiles: coreFiles,
  applicationReady: false,
  maximumChangedFiles: 100,
  phase: "governance",
  schemaVersion: 1,
  ...overrides,
});
const isCoreAuthPhaseFile = (file) =>
  /^(?:src\/(?:app|layouts|features\/(?:forgot-pass|login|register))\/|docs\/(?:core-auth|admin-request-reliability|adr\/|architecture|security\/authentication-review))/.test(
    file,
  ) ||
  [
    "src/features/auth/useOtpRequest.ts",
    "src/features/auth/useOtpRequest.test.tsx",
  ].includes(file);

const isBusinessPhaseFile = (file) =>
  /^src\/features\/(?:account|calendar|dashboard|roles|settings|users)\//.test(
    file,
  )
    ? !/\/(?:api(?:\.helpers)?(?:\.test)?|types)\.tsx?$/.test(file)
    : /^src\/(?:shared\/hooks\/useMutationRequest|test\/(?:storybook\/|integration\/forms\.test))/.test(
        file,
      ) ||
      /^docs\/(?:api-client|input-validation|business-screens)(?:\.fa)?\.md$/.test(
        file,
      );

const isStorybookPhaseFile = (file) =>
  file.startsWith(".storybook/") ||
  file.endsWith(".stories.tsx") ||
  file === "vitest.storybook.config.ts" ||
  /^(?:docs\/storybook-verification(?:\.fa)?\.md|src\/test\/storybook\/(?:StoryAppearance\.ts|StoryShell\.test\.tsx))$/.test(
    file,
  );

const isGuidancePhaseFile = (file) =>
  (file.startsWith(".agents/") && file !== ".agents/validation.json") ||
  file.startsWith(".claude/") ||
  [
    ".github/CODEOWNERS",
    ".github/dependabot.yml",
    "CLAUDE.md",
    "DESIGN.md",
    "DESIGN.fa.md",
  ].includes(file) ||
  /^docs\/(?:README|ai-code-understanding|change-workflow|comprehension-evaluation|feature-development|quality-attributes|source-navigation|testing|validation)(?:\.fa)?\.md$/.test(
    file,
  ) ||
  /^scripts\/(?:ai-hooks(?:\.portable)?\.test|check-guidance|guidance\.test)\.mjs$/.test(
    file,
  );

const operationsPrerequisiteFiles = [
  ".dockerignore",
  ".env.example",
  ".release-please-manifest.json",
  "SECURITY.fa.md",
  "SECURITY.md",
  "deploy/docker/.env.example",
  "deploy/docker/Dockerfile",
  "deploy/docker/README.fa.md",
  "deploy/docker/README.md",
  "deploy/docker/compose.yaml",
  "deploy/docker/resources.mjs",
  "deploy/docker/smoke.mjs",
  "deploy/native/README.fa.md",
  "deploy/native/README.md",
  "deploy/native/hosts.env.example",
  "deploy/native/nginx/admin.conf.template",
  "deploy/native/nginx/bootstrap.conf.template",
  "docs/accessibility.fa.md",
  "docs/accessibility.md",
  "docs/backup-restore.fa.md",
  "docs/backup-restore.md",
  "docs/component-coverage.fa.md",
  "docs/component-coverage.md",
  "docs/contract-testing.fa.md",
  "docs/contract-testing.md",
  "docs/deployment.fa.md",
  "docs/deployment.md",
  "docs/performance.fa.md",
  "docs/performance.md",
  "docs/release-operations.fa.md",
  "docs/release-operations.md",
  "docs/releasing.fa.md",
  "docs/releasing.md",
  "docs/security/reviews.fa.md",
  "docs/security/reviews.md",
  "docs/security/threat-model.fa.md",
  "docs/security/threat-model.md",
  "docs/staging.fa.md",
  "docs/staging.md",
  "docs/test-reliability.fa.md",
  "docs/test-reliability.md",
  "docs/visual-regression.fa.md",
  "docs/visual-regression.md",
  "e2e/visual/baselines/win32/admin-login-en-light.png",
  "e2e/visual/baselines/win32/admin-login-fa-dark.png",
  "e2e/visual/baselines/win32/admin-role-drawer-en-dark.png",
  "e2e/visual/baselines/win32/admin-users-fa-light.png",
  "e2e/visual/baselines/win32/metadata.json",
  "release-please-config.json",
  "scripts/check-bundle-size.mjs",
  "scripts/check-bundle-size.test.mjs",
  "scripts/deployment.test.mjs",
  "scripts/docker-smoke-resources.test.mjs",
  "scripts/healthcheck.mjs",
  "scripts/lighthouse-policy.mjs",
  "scripts/package-release.mjs",
  "scripts/package-release.test.mjs",
  "scripts/render-deployment.mjs",
  "scripts/run-lighthouse.mjs",
  "scripts/run-lighthouse.test.mjs",
  "scripts/run-visual.mjs",
  "scripts/stamp-admin-build.mjs",
  "scripts/validate-deployment-env.mjs",
  "scripts/validate-production-env.mjs",
  "scripts/validate-production-env.test.mjs",
  "scripts/validate-workflow-targets.mjs",
  "scripts/validate-workflow-targets.test.mjs",
  "scripts/visual-environment.mjs",
  "scripts/visual.test.mjs",
  "tooling/paths.ts",
];

const historicalStorybookPolicy = async () => {
  const latest = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  return {
    ...latest,
    phase: "storybook-verification",
    allowedFiles: [
      ...new Set([...latest.allowedFiles, ".github/workflows/sonar.yml"]),
    ].filter(
      (file) =>
        !isGuidancePhaseFile(file) &&
        !operationsPrerequisiteFiles.includes(file),
    ),
  };
};

const foundationFiles = [
  ...coreFiles.filter((file) => file !== ".github/workflows/bootstrap.yml"),
  ".agents/validation.json",
  ".github/workflows/ci.yml",
  "package.json",
  "package-lock.json",
  "scripts/validate.mjs",
  "scripts/validate.test.mjs",
  "scripts/check-ci.mjs",
  "scripts/check-ci.test.mjs",
  "src/shared/api/token.ts",
  "src/shared/api/token.test.ts",
  "src/shared/api/types.ts",
  "src/shared/contracts/index.ts",
  "src/shared/lib/transform.ts",
  "src/shared/lib/transform.test.ts",
  "src/shared/lib/color-contrast.ts",
  "src/shared/lib/color-contrast.test.ts",
  "tsconfig.json",
];
const foundationPolicy = (overrides = {}) =>
  policy({
    allowedFiles: foundationFiles,
    phase: "foundation",
    ...overrides,
  });
const catalogFiles = [
  "src/shared/i18n/catalogs.ts",
  "src/shared/i18n/catalogs.test.ts",
  "src/shared/i18n/locales.ts",
  "src/shared/i18n/dayjs/fa.ts",
  ...["ar", "de", "en", "es", "fa", "fr", "it", "pt", "ru", "tr"].map(
    (code) => `src/shared/i18n/locales/${code}.ts`,
  ),
];
const catalogPolicy = (overrides = {}) =>
  foundationPolicy({
    phase: "catalogs",
    allowedFiles: [...foundationFiles, ...catalogFiles],
    ...overrides,
  });

const fixture = async (context, declaredPolicy = policy()) => {
  const parent = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(parent, "kernel-bootstrap-test-"));
  context.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), parent);
    assert.ok(path.basename(root).startsWith("kernel-bootstrap-test-"));
    await rm(root, { force: true, recursive: true });
  });
  const put = async (file, content) => {
    const absolute = path.join(root, file);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  };
  for (const file of declaredPolicy.allowedFiles)
    await put(
      file,
      file.endsWith(".json")
        ? JSON.stringify(file === coreFiles[0] ? declaredPolicy : {})
        : "// synthetic fixture\n",
    );
  return { put, root };
};

test("accepts only the declared governance phase and immutable 100-file maximum", () => {
  assert.equal(validateBootstrapPolicy(policy()).size, coreFiles.length);
  for (const overrides of [
    { phase: "application" },
    { applicationReady: true },
    { maximumChangedFiles: 101 },
    { schemaVersion: 2 },
    { allowedFiles: [] },
    { allowedFiles: coreFiles.slice(1) },
  ])
    assert.throws(() => validateBootstrapPolicy(policy(overrides)));
});

test("rejects wildcard, escaping, private, duplicate and application import paths", () => {
  for (const file of [
    "src/index.ts",
    "drizzle/0000.sql",
    "collection/auth/index.bru",
    "package.json",
    "package-lock.json",
    "server/data/live.sqlite",
    ".env.local",
    ".agents/settings.local.json",
    "docs/**",
    "../outside.md",
    "/absolute.md",
    "C:/outside.md",
    "docs\\outside.md",
    coreFiles[0],
  ])
    assert.throws(() =>
      validateBootstrapPolicy(policy({ allowedFiles: [...coreFiles, file] })),
    );
});

test("validates an isolated exact snapshot and states that the admin application is not ready", async (context) => {
  const { root } = await fixture(context);
  await mkdir(path.join(root, ".git"));
  assert.deepEqual(await inspectBootstrap(root), {
    applicationReady: false,
    files: coreFiles.length,
    phase: "governance",
    scope:
      "Published governance files only; the admin application is not published or validated.",
  });
});

test("fails for missing declared files and ambient untracked application files", async (context) => {
  const { put, root } = await fixture(context);
  await rm(path.join(root, coreFiles[1]));
  await assert.rejects(inspectBootstrap(root), /missing declared files/);
  await put(coreFiles[1], "name: Bootstrap\n");
  await put("src/index.ts", "throw new Error('must never run');\n");
  await assert.rejects(
    inspectBootstrap(root),
    /Unexpected bootstrap path: src/,
  );
});

test("fails before reading unexpected private files or following links", async (context) => {
  const { put, root } = await fixture(context);
  await put(".env.local", "synthetic-private-fixture\n");
  await assert.rejects(inspectBootstrap(root), /Unexpected bootstrap path/);
  await rm(path.join(root, ".env.local"));
  await symlink(
    path.join(root, "scripts"),
    path.join(root, "linked-scripts"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(inspectBootstrap(root), /symbolic links/);
});

test("rejects invalid JSON and invalid JavaScript without executing it", async (context) => {
  const { put, root } = await fixture(context);
  await put(coreFiles[3], "const = ;\n");
  await assert.rejects(inspectBootstrap(root), /JavaScript syntax is invalid/);
  await put(
    coreFiles[3],
    "throw new Error('syntax check must not execute');\n",
  );
  assert.equal((await inspectBootstrap(root)).applicationReady, false);
  await put(coreFiles[0], "not json");
  await assert.rejects(inspectBootstrap(root), SyntaxError);
});

test("foundation allows its pure source and toolchain, while rejecting runnable application paths", () => {
  assert.equal(
    validateBootstrapPolicy(foundationPolicy()).size,
    foundationFiles.length,
  );
  for (const file of [
    "src/index.ts",
    "src/main.tsx",
    "src/app/App.tsx",
    "src/features/users/Users.tsx",
    "src/shared/api/client.ts",
    "src/shared/lib/undeclared.ts",
    "src/application/auth.ts",
    "src/infrastructure/db/client.ts",
    "src/presentation/http/app.ts",
    "drizzle.config.ts",
  ])
    assert.throws(() =>
      validateBootstrapPolicy(
        foundationPolicy({ allowedFiles: [...foundationFiles, file] }),
      ),
    );
  assert.throws(
    () =>
      validateBootstrapPolicy(
        foundationPolicy({
          allowedFiles: foundationFiles.filter(
            (file) => file !== "package-lock.json",
          ),
        }),
      ),
    /mandatory/,
  );
});

test("catalog publication requires every language, registry, calendar-data and test file", () => {
  assert.equal(
    validateBootstrapPolicy(catalogPolicy()).size,
    foundationFiles.length + catalogFiles.length,
  );
  for (const missing of catalogFiles)
    assert.throws(
      () =>
        validateBootstrapPolicy(
          catalogPolicy({
            allowedFiles: [...foundationFiles, ...catalogFiles].filter(
              (file) => file !== missing,
            ),
          }),
        ),
      /mandatory guard files/,
    );
});

test("catalog publication cannot admit runtime adapters, split catalogs or unrelated application source", () => {
  for (const file of [
    "src/shared/i18n/index.ts",
    "src/shared/i18n/date.ts",
    "src/shared/i18n/common.ts",
    "src/shared/i18n/locales/fa/common.ts",
    "src/shared/i18n/locales/xx.ts",
    "src/features/settings/api.ts",
    "src/main.tsx",
  ])
    assert.throws(() =>
      validateBootstrapPolicy(
        catalogPolicy({
          allowedFiles: [...foundationFiles, ...catalogFiles, file],
        }),
      ),
    );
  assert.throws(() =>
    validateBootstrapPolicy(catalogPolicy({ applicationReady: true })),
  );
  for (const file of catalogFiles)
    assert.throws(() =>
      validateBootstrapPolicy(
        foundationPolicy({ allowedFiles: [...foundationFiles, file] }),
      ),
    );
});

test("catalog publication inspects its exact non-runnable snapshot and ignores only ordinary generated directories", async (context) => {
  const { root, put } = await fixture(context, catalogPolicy());
  await mkdir(path.join(root, "node_modules"));
  await mkdir(path.join(root, "coverage"));
  assert.deepEqual(await inspectBootstrap(root), {
    applicationReady: false,
    files: foundationFiles.length + catalogFiles.length,
    phase: "catalogs",
    scope:
      "Published admin primitives and complete local catalog data; runtime translation adapters, UI, API integration and browser behavior are not published or validated.",
  });
  await put("src/shared/i18n/common.ts", "// undeclared source\n");
  await assert.rejects(inspectBootstrap(root), /Unexpected bootstrap path/);
});

test("the 100-file limit applies to a PR delta rather than the total published inventory", () => {
  const files = [
    ...foundationFiles,
    ...Array.from({ length: 110 }, (_, index) => `docs/topic-${index}.md`),
  ];
  assert.equal(
    validateBootstrapPolicy(foundationPolicy({ allowedFiles: files })).size,
    files.length,
  );
  assert.throws(() =>
    validateBootstrapPolicy(foundationPolicy({ maximumChangedFiles: 101 })),
  );
});

test("foundation validates its exact source while ignoring only ordinary generated root directories", async (context) => {
  const { root, put } = await fixture(context, foundationPolicy());
  await mkdir(path.join(root, "node_modules"));
  await mkdir(path.join(root, "coverage"));
  await put("node_modules/ignored.json", "not parsed");
  await put("coverage/ignored.json", "not parsed");
  const result = await inspectBootstrap(root);
  assert.equal(result.phase, "foundation");
  assert.equal(result.applicationReady, false);
  assert.equal(result.files, foundationFiles.length);
  await put("src/undeclared.ts", "throw new Error('not run');");
  await assert.rejects(inspectBootstrap(root), /Unexpected bootstrap path/);
});

test("generated output names cannot hide files or links", async (context) => {
  const { root, put } = await fixture(context, foundationPolicy());
  await put("coverage", "not a directory");
  await assert.rejects(inspectBootstrap(root), /ordinary root directory/);
  await rm(path.join(root, "coverage"));
  await symlink(
    path.join(root, "src"),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(inspectBootstrap(root), /ordinary root directory/);
});

const runtimeFiles = [
  "src/shared/config/language.ts",
  "src/shared/config/language.test.ts",
  "src/shared/i18n/index.ts",
  "src/shared/i18n/index.test.ts",
  "src/shared/i18n/date.ts",
  "src/shared/i18n/date.test.ts",
  "src/shared/i18n/dayjs.test.ts",
  "src/shared/lib/error.ts",
  "src/shared/lib/error.test.ts",
];
const runtimePolicy = (overrides = {}) =>
  catalogPolicy({
    phase: "runtime-localization",
    allowedFiles: [...foundationFiles, ...catalogFiles, ...runtimeFiles],
    ...overrides,
  });

test("runtime-localization requires the complete adapters, catalogs and their tests", () => {
  assert.equal(
    validateBootstrapPolicy(runtimePolicy()).size,
    foundationFiles.length + catalogFiles.length + runtimeFiles.length,
  );
  for (const missing of [...catalogFiles, ...runtimeFiles])
    assert.throws(
      () =>
        validateBootstrapPolicy(
          runtimePolicy({
            allowedFiles: [
              ...foundationFiles,
              ...catalogFiles,
              ...runtimeFiles,
            ].filter((file) => file !== missing),
          }),
        ),
      /mandatory/,
    );
  for (const file of [
    "src/main.tsx",
    "src/app/App.tsx",
    "src/shared/api/client.ts",
    "src/shared/i18n/unpublished.ts",
  ])
    assert.throws(() =>
      validateBootstrapPolicy(
        runtimePolicy({
          allowedFiles: [
            ...foundationFiles,
            ...catalogFiles,
            ...runtimeFiles,
            file,
          ],
        }),
      ),
    );
  assert.throws(() =>
    validateBootstrapPolicy(runtimePolicy({ applicationReady: true })),
  );
});

test("runtime-localization inspects its exact non-runnable inventory", async (context) => {
  const { root } = await fixture(context, runtimePolicy());
  const result = await inspectBootstrap(root);
  assert.equal(result.phase, "runtime-localization");
  assert.equal(result.applicationReady, false);
  assert.equal(
    result.files,
    foundationFiles.length + catalogFiles.length + runtimeFiles.length,
  );
});

test("UI foundation requires the complete previous HTTP closure and forbids application composition", async (context) => {
  const latest = await historicalStorybookPolicy();
  const current = {
    ...latest,
    phase: "ui-foundation",
    allowedFiles: latest.allowedFiles.filter(
      (file) =>
        !isCoreAuthPhaseFile(file) &&
        !isBusinessPhaseFile(file) &&
        !isStorybookPhaseFile(file),
    ),
  };
  assert.equal(current.phase, "ui-foundation");
  assert.equal(validateBootstrapPolicy(current).size, 169);
  const required = current.allowedFiles.filter(
    (file) =>
      (file.startsWith("src/") &&
        !runtimePolicy().allowedFiles.includes(file)) ||
      /^docs\/(?:http-client|request-lifecycle|ui-foundation)(?:\.fa)?\.md$/.test(
        file,
      ) ||
      file.startsWith("public/"),
  );
  assert.equal(required.length, 94);
  for (const missing of required)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: current.allowedFiles.filter((file) => file !== missing),
        }),
      /mandatory/,
    );
  for (const file of [
    "src/main.tsx",
    "src/app/Core.tsx",
    "src/shared/ui/unpublished.tsx",
    "src/features/users/Users.tsx",
    "src/shared/hooks/unpublished.ts",
    "src/shared/api/client.spec.ts",
    "src/test/unlisted.ts",
    "apps/admin/index.ts",
    "packages/contracts/index.ts",
  ])
    assert.throws(() =>
      validateBootstrapPolicy({
        ...current,
        allowedFiles: [...current.allowedFiles, file],
      }),
    );
  assert.throws(() =>
    validateBootstrapPolicy({ ...current, applicationReady: true }),
  );
  const { root } = await fixture(context, current);
  const result = await inspectBootstrap(root);
  assert.equal(result.phase, "ui-foundation");
  assert.equal(result.applicationReady, false);
  assert.match(result.scope, /synthetic HTTP\/React tests/);
  assert.equal(result.files, 169);
});

test("core-auth preserves its complete prior closure, owners and tests without a runnable entry", async (context) => {
  const latest = await historicalStorybookPolicy();
  const current = {
    ...latest,
    phase: "core-auth",
    allowedFiles: latest.allowedFiles.filter(
      (file) => !isBusinessPhaseFile(file) && !isStorybookPhaseFile(file),
    ),
  };
  assert.equal(current.phase, "core-auth");
  assert.equal(validateBootstrapPolicy(current).size, 223);
  const phaseFiles = current.allowedFiles.filter(isCoreAuthPhaseFile);
  assert.equal(phaseFiles.length, 54);
  for (const missing of phaseFiles)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: current.allowedFiles.filter((file) => file !== missing),
        }),
      /mandatory/,
    );
  for (const file of [
    "index.html",
    "src/main.tsx",
    "src/app/App.tsx",
    "src/app/Routes.tsx",
    "src/features/users/Users.tsx",
    "src/features/login/unpublished.tsx",
    "src/test/storybook/fixtures.ts",
  ])
    assert.throws(() =>
      validateBootstrapPolicy({
        ...current,
        allowedFiles: [...current.allowedFiles, file],
      }),
    );
  assert.throws(() =>
    validateBootstrapPolicy({ ...current, applicationReady: true }),
  );
  const { root } = await fixture(context, current);
  const result = await inspectBootstrap(root);
  assert.equal(result.phase, "core-auth");
  assert.equal(result.files, 223);
  assert.equal(result.applicationReady, false);
  assert.match(result.scope, /no application entry point/);
});

test("business screens require the complete prior closure and all guarded form modules without application or Storybook composition", async (context) => {
  const latest = await historicalStorybookPolicy();
  const current = {
    ...latest,
    phase: "business-screens",
    allowedFiles: latest.allowedFiles.filter(
      (file) => !isStorybookPhaseFile(file),
    ),
  };
  assert.equal(current.phase, "business-screens");
  assert.equal(
    validateBootstrapPolicy(current).size,
    current.allowedFiles.length,
  );
  const required = current.allowedFiles.filter(
    (file) => isBusinessPhaseFile(file) || isCoreAuthPhaseFile(file),
  );
  for (const missing of required)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: current.allowedFiles.filter((file) => file !== missing),
        }),
      /mandatory/,
    );
  for (const file of [
    "index.html",
    "src/main.tsx",
    "src/app/App.tsx",
    "src/app/Routes.tsx",
    "src/features/users/unpublished.ts",
    "src/features/account/Account.stories.tsx",
    "src/test/unlisted.ts",
    "apps/admin/index.ts",
    "packages/contracts/index.ts",
  ])
    assert.throws(() =>
      validateBootstrapPolicy({
        ...current,
        allowedFiles: [...current.allowedFiles, file],
      }),
    );
  assert.throws(() =>
    validateBootstrapPolicy({ ...current, applicationReady: true }),
  );
  const { root } = await fixture(context, current);
  const result = await inspectBootstrap(root);
  assert.equal(result.phase, "business-screens");
  assert.equal(result.applicationReady, false);
  assert.match(result.scope, /no application entry point/);
});

test("Storybook verification requires every explicit story, isolated configuration and browser fixture without publishing an application", async (context) => {
  const current = await historicalStorybookPolicy();
  assert.equal(current.phase, "storybook-verification");
  const required = current.allowedFiles.filter(isStorybookPhaseFile);
  assert.equal(required.length, 37);
  for (const missing of required) {
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: current.allowedFiles.filter((file) => file !== missing),
        }),
      /mandatory/,
    );
  }
  for (const file of [
    "index.html",
    "src/main.tsx",
    "src/app/App.tsx",
    "src/app/Routes.tsx",
    "src/features/users/Unpublished.stories.tsx",
    ".storybook/ambient.ts",
    "src/test/storybook/ambient.ts",
    "vite.config.ts",
  ]) {
    const invalid = {
      ...current,
      allowedFiles: [...current.allowedFiles, file],
    };
    assert.throws(() => validateBootstrapPolicy(invalid));
  }
  assert.throws(() =>
    validateBootstrapPolicy({ ...current, applicationReady: true }),
  );
  const { root } = await fixture(context, current);
  const result = await inspectBootstrap(root);
  assert.equal(result.files, current.allowedFiles.length);
  assert.equal(result.applicationReady, false);
  assert.match(result.scope, /real Chromium component interactions/);
});

test("assistant guidance retains the complete workshop and requires every declared guidance artifact", async (context) => {
  const current = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(current.phase, "assistant-guidance");
  assert.equal(validateBootstrapPolicy(current).size, 435);
  const additions = current.allowedFiles.filter(isGuidancePhaseFile);
  assert.equal(additions.length, 63);
  for (const missing of [
    ...additions,
    "AGENTS.md",
    ".storybook/vite.config.ts",
    "src/shared/api/client.ts",
    "src/app/providers/core/Core.tsx",
  ]) {
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: current.allowedFiles.filter((file) => file !== missing),
        }),
      /mandatory/,
    );
  }
  for (const file of [
    "index.html",
    "src/main.tsx",
    "src/app/App.tsx",
    "src/app/Routes.tsx",
    "vite.config.ts",
    ".agents/hooks/unlisted.mjs",
    ".claude/skills/unlisted/SKILL.md",
    "server/data/live.sqlite",
  ]) {
    assert.throws(() =>
      validateBootstrapPolicy({
        ...current,
        allowedFiles: [...current.allowedFiles, file],
      }),
    );
  }
  assert.throws(() =>
    validateBootstrapPolicy({ ...current, applicationReady: true }),
  );
  const { root } = await fixture(context, current);
  const result = await inspectBootstrap(root);
  assert.equal(result.files, 435);
  assert.equal(result.applicationReady, false);
  assert.match(result.scope, /assistant-neutral instructions/);
  assert.match(result.scope, /no application entry point/);
});

test("the assistant entrypoint requirement does not change historical phase inventories", async () => {
  const current = await historicalStorybookPolicy();
  assert.ok(current.allowedFiles.includes("AGENTS.md"));
  const withoutEntryPoint = current.allowedFiles.filter(
    (file) => file !== "AGENTS.md",
  );
  assert.equal(
    validateBootstrapPolicy({ ...current, allowedFiles: withoutEntryPoint })
      .size,
    current.allowedFiles.length - 1,
  );
});

test("guidance artifacts cannot be backported into earlier publication phases", async () => {
  const current = await historicalStorybookPolicy();
  for (const file of [
    ".agents/settings.json",
    ".agents/hooks/block-dangerous.mjs",
    "CLAUDE.md",
    "DESIGN.md",
    "scripts/check-guidance.mjs",
    "docs/source-navigation.md",
  ]) {
    assert.throws(() =>
      validateBootstrapPolicy({
        ...current,
        allowedFiles: [...current.allowedFiles, file],
      }),
    );
  }
});

test("release and quality prerequisites require their complete finite closure in the current non-runnable phase", async () => {
  const current = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(operationsPrerequisiteFiles.length, 70);
  for (const missing of operationsPrerequisiteFiles)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: current.allowedFiles.filter((file) => file !== missing),
        }),
      /mandatory/,
    );
  for (const file of [
    "deploy/native/api.env.example",
    "deploy/docker/.env.production",
    "deploy/docker/.ENV.EXAMPLE",
    "env/production.json",
    ".env.local",
    "examples/example.env",
    "deploy/native/live.pem",
    "deploy/unlisted.mjs",
    "e2e/visual.spec.ts",
    "tooling/unlisted.ts",
    "scripts/run-lighthouse-unlisted.mjs",
    "stryker.config.json",
  ])
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: [...current.allowedFiles, file],
        }),
      /unique, exact paths/,
    );
  const historical = await historicalStorybookPolicy();
  for (const file of operationsPrerequisiteFiles)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...historical,
          allowedFiles: [...historical.allowedFiles, file],
        }),
      /unique, exact paths/,
    );
});

test("current prerequisites retain only the three synthetic public template names and reject ambient private files", async (context) => {
  const current = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  const { root, put } = await fixture(context, current);
  assert.equal((await inspectBootstrap(root)).files, 435);
  await put(
    "deploy/native/.env.local",
    "synthetic forbidden contents must never be parsed",
  );
  await assert.rejects(inspectBootstrap(root), /Unexpected bootstrap path/);
});
