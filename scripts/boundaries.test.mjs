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
const check = (specifier, resolved, source = file) =>
  boundaryViolation({ root, file: source, specifier, resolved });

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

test("the exact current foundation has five contained production modules", async () => {
  const result = await checkBoundaries();
  assert.equal(result.files, 5);
  assert.deepEqual(result.violations, []);
});
