import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  boundaryViolation,
  checkBoundaries,
  inspectImports,
} from "./check-boundaries.mjs";

const root = path.resolve("synthetic-foundation");
const file = path.join(root, "src/shared/api/token.ts");
const check = (specifier, resolved, source = file, typeOnly = false) =>
  boundaryViolation({ root, file: source, specifier, resolved, typeOnly });

test("captures static, erased, re-export, dynamic, require and computed import edges", () => {
  const edges = inspectImports(
    'import { Token } from "./types.ts";\nimport type { Type } from "react";\nexport type * from "@kernel/contracts";\ntype Database = import("node:sqlite").DatabaseSync;\nconst value = import("hono");\nconst data = require("drizzle-orm");\nimport sdk = require("better-auth");\nimport(variable);\n// import("not-an-edge")',
  );
  assert.deepEqual(
    edges.map((edge) => edge.specifier),
    [
      "./types.ts",
      "react",
      "@kernel/contracts",
      "node:sqlite",
      "hono",
      "drizzle-orm",
      "better-auth",
      undefined,
    ],
  );
  assert.equal(edges[0].line, 1);
  assert.deepEqual(
    edges.map((edge) => edge.typeOnly),
    [false, true, true, true, false, false, false, false],
  );
});

test("production imports cannot target packages or builtins even through erased types", () => {
  for (const specifier of [
    "react",
    "axios",
    "vitest",
    "node:sqlite",
    "node:crypto",
    "@kernel/api",
    "hono",
  ])
    for (const syntax of [
      `import type { Value } from "${specifier}";`,
      `const value = import("${specifier}");`,
    ]) {
      const [edge] = inspectImports(syntax);
      assert.match(
        check(
          edge.specifier,
          path.join(root, "node_modules", specifier, "index.d.ts"),
        ),
        /packages and Node builtins/,
      );
    }
});

test("only resolved published production modules are valid local targets", () => {
  const types = path.join(root, "src/shared/api/types.ts");
  assert.equal(check("./types.ts", types), undefined);
  assert.equal(check("@/shared/api/types", types), undefined);
  for (const target of [
    undefined,
    path.join(root, "src/shared/api/token.test.ts"),
    path.join(root, "src/shared/api/unpublished.ts"),
    path.resolve(root, "../another-project/src/shared/api/types.ts"),
  ])
    assert.match(check("./types.ts", target), /published production modules/);
  assert.match(check(undefined, types), /literal module paths/);
  assert.match(
    check("custom-package-alias", types),
    /packages and Node builtins/,
  );
});

test("wire contracts cannot import other published infrastructure", () => {
  const contract = path.join(root, "src/shared/contracts/index.ts");
  assert.match(
    check("@/shared/api/token", file, contract),
    /pure contract modules/,
  );
  assert.equal(check("./index.ts", contract, contract), undefined);
});

test("catalog data resolves only to its own published pure local modules", () => {
  const catalog = path.join(root, "src/shared/i18n/catalogs.ts");
  const english = path.join(root, "src/shared/i18n/locales/en.ts");
  assert.equal(check("./locales/en.ts", english, catalog), undefined);
  assert.equal(
    check(
      "./en.ts",
      english,
      path.join(root, "src/shared/i18n/locales/fa.ts"),
      true,
    ),
    undefined,
  );
  assert.match(
    check("../api/token.ts", file, catalog),
    /Catalog data must depend only/,
  );
  for (const runtime of ["index.ts", "date.ts"])
    assert.match(
      check(
        `./${runtime}`,
        path.join(root, "src/shared/i18n", runtime),
        catalog,
      ),
      /Catalog data must depend only/,
    );
  for (const dependency of ["react", "i18next", "dayjs", "@kernel/i18n"])
    assert.match(
      check(dependency, english, catalog),
      /packages and Node builtins/,
    );
});

test("catalog data cannot import English runtime fallback through static, dynamic or require forms", () => {
  const english = path.join(root, "src/shared/i18n/locales/en.ts");
  const persian = path.join(root, "src/shared/i18n/locales/fa.ts");
  for (const syntax of [
    'import { en } from "./en.ts";',
    'import { type TranslationCatalog } from "./en.ts";',
    'export { en } from "./en.ts";',
    'const english = import("./en.ts");',
    'const english = require("./en.ts");',
    'import english = require("./en.ts");',
  ]) {
    const [edge] = inspectImports(syntax);
    assert.match(
      check(edge.specifier, english, persian, edge.typeOnly),
      /fully erased type references/,
    );
  }
  for (const syntax of [
    'import type { TranslationCatalog } from "./en.ts";',
    'export type { TranslationCatalog } from "./en.ts";',
    'type Catalog = import("./en.ts").TranslationCatalog;',
    'import type Catalog = require("./en.ts");',
  ]) {
    const [edge] = inspectImports(syntax);
    assert.equal(
      check(edge.specifier, english, persian, edge.typeOnly),
      undefined,
    );
  }
  for (const source of [
    path.join(root, "src/shared/i18n/locales.ts"),
    path.join(root, "src/shared/i18n/dayjs/fa.ts"),
  ]) {
    assert.match(check("./locales/en.ts", english, source), /fully erased/);
    assert.equal(check("./locales/en.ts", english, source, true), undefined);
  }
});

const fixture = async (context) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "admin-foundation-boundary-"),
  );
  context.after(async () => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(
      path.basename(directory).startsWith("admin-foundation-boundary-"),
    );
    await rm(directory, { recursive: true, force: true });
  });
  const put = async (name, content) => {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  };
  await put("package.json", JSON.stringify({ name: "synthetic-foundation" }));
  await put(
    "tsconfig.app.json",
    JSON.stringify({
      compilerOptions: { module: "ESNext", moduleResolution: "bundler" },
      include: ["src/**/*.ts"],
    }),
  );
  await put(
    "src/shared/api/types.ts",
    "export type Token = { accessToken: string };",
  );
  return { directory, put };
};

test("actual resolution rejects an external declaration, tests, missing modules and another checkout", async (context) => {
  const { directory, put } = await fixture(context);
  await put(
    "node_modules/synthetic-sdk/package.json",
    JSON.stringify({ name: "synthetic-sdk", types: "index.d.ts" }),
  );
  await put(
    "node_modules/synthetic-sdk/index.d.ts",
    "export type Database = { id: string };",
  );
  await put("src/shared/api/token.test.ts", "export type TestOnly = string;");
  await put(
    "src/shared/api/token.ts",
    [
      'import type { Token } from "./types.ts";',
      'import type { Database } from "synthetic-sdk";',
      'export type * from "./token.test.ts";',
      'import "./missing.ts";',
      'import "../../../../another-project/types.ts";',
    ].join("\n"),
  );
  const result = await checkBoundaries(directory);
  assert.equal(result.files, 2);
  assert.equal(result.violations.length, 4);
  assert.deepEqual(
    result.violations.map((violation) => violation.match(/token.ts:(\d+):/)[1]),
    ["2", "3", "4", "5"],
  );
});

test("undeclared production and linked source are not hidden by an empty import list", async (context) => {
  const { directory, put } = await fixture(context);
  await put("src/shared/lib/unpublished.ts", "export const value = 1;");
  assert.match(
    (await checkBoundaries(directory)).violations.join("\n"),
    /Unpublished production module/,
  );
  await rm(path.join(directory, "src/shared/lib/unpublished.ts"));
  await symlink(
    path.join(directory, "src/shared/api"),
    path.join(directory, "src/shared/linked"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(checkBoundaries(directory), /symbolic links/);
});

test("the exact current runtime-localization phase has twenty-two contained production modules", async () => {
  const result = await checkBoundaries();
  assert.equal(result.files, 22);
  assert.deepEqual(result.violations, []);
});

test("relative and linked checkout roots use the same canonical production boundary", async (context) => {
  const { directory, put } = await fixture(context);
  await put(
    "src/shared/api/token.ts",
    'import type { Token } from "./types.ts";',
  );
  const linkedRoot = path.join(directory, "linked-checkout");
  await symlink(
    directory,
    linkedRoot,
    process.platform === "win32" ? "junction" : "dir",
  );

  const direct = await checkBoundaries(directory);
  const linked = await checkBoundaries(linkedRoot);

  assert.deepEqual(direct.violations, []);
  assert.deepEqual(linked, direct);
  assert.deepEqual(
    await checkBoundaries(path.relative(process.cwd(), directory)),
    direct,
  );

  await put("src/shared/api/token.test.ts", "export type TestOnly = string;");
  await put(
    "src/shared/api/token.ts",
    'import type { TestOnly } from "./token.test.ts";',
  );
  assert.match(
    (await checkBoundaries(linkedRoot)).violations.join("\n"),
    /published production modules/,
  );
});

test("runtime adapters may import only exact declared packages contained in this checkout", () => {
  for (const [source, specifier, dependency] of [
    ["src/shared/i18n/index.ts", "i18next", "i18next"],
    ["src/shared/i18n/index.ts", "react-i18next", "react-i18next"],
    ["src/shared/i18n/date.ts", "dayjs/locale/en-gb", "dayjs"],
    ["src/shared/i18n/date.ts", "jalaliday", "jalaliday"],
  ]) {
    const adapter = path.join(root, source);
    const target = path.join(root, "node_modules", dependency, "index.d.ts");
    assert.equal(check(specifier, target, adapter), undefined);
    assert.match(
      check(
        specifier,
        path.resolve(
          root,
          "../another-checkout/node_modules",
          dependency,
          "index.d.ts",
        ),
        adapter,
      ),
      /not allowed/,
    );
    assert.match(check("node:fs", target, adapter), /not allowed/);
    assert.match(check("dayjs/locale/xx", target, adapter), /not allowed/);
  }
});

test("pure catalog and contract modules cannot depend on the published runtime adapters", () => {
  const adapter = path.join(root, "src/shared/i18n/index.ts");
  for (const source of [
    "src/shared/i18n/catalogs.ts",
    "src/shared/i18n/locales/fa.ts",
    "src/shared/contracts/index.ts",
  ]) {
    assert.match(
      check("../i18n/index", adapter, path.join(root, source)),
      /(?:Catalog data|Wire contracts)/,
    );
  }
});
