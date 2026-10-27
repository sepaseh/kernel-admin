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

test("HTTP/lifecycle publication requires the complete independent closure without admitting UI or source links", async (context) => {
  const current = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(current.phase, "http-lifecycle");
  assert.equal(validateBootstrapPolicy(current).size, 118);
  const required = current.allowedFiles.filter(
    (file) =>
      (file.startsWith("src/") &&
        !runtimePolicy().allowedFiles.includes(file)) ||
      /^docs\/(?:http-client|request-lifecycle)(?:\.fa)?\.md$/.test(file),
  );
  assert.equal(required.length, 43);
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
    "src/shared/config/theme.ts",
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
  assert.equal(result.phase, "http-lifecycle");
  assert.equal(result.applicationReady, false);
  assert.match(result.scope, /synthetic HTTP and real hook tests/);
  assert.equal(result.files, 118);
});
