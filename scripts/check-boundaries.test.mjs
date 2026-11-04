import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
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
const check = (
  specifier,
  resolved,
  source = file,
  typeOnly = false,
  resolvedPackage,
) =>
  boundaryViolation({
    root,
    file: source,
    specifier,
    resolved,
    typeOnly,
    resolvedPackage,
  });

test("captures static, erased, re-export, dynamic, require and computed import edges", () => {
  const edges = inspectImports(
    'import { Token } from "./types.ts";\nimport type { Type } from "react";\nexport type * from "@example/contracts";\ntype Database = import("node:sqlite").DatabaseSync;\nconst value = import("hono");\nconst data = require("drizzle-orm");\nimport sdk = require("better-auth");\nimport(variable);\n// import("not-an-edge")',
  );
  assert.deepEqual(
    edges.map((edge) => edge.specifier),
    [
      "./types.ts",
      "react",
      "@example/contracts",
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
    "@example/backend",
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
    path.join(root, "src/features/users/Users.stories.tsx"),
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

const dependencyForms = [
  (specifier) => `import { Value } from "${specifier}";`,
  (specifier) => `import type { Value } from "${specifier}";`,
  (specifier) => `import { type Value } from "${specifier}";`,
  (specifier) => `export { Value } from "${specifier}";`,
  (specifier) => `export type { Value } from "${specifier}";`,
  (specifier) => `type Value = import("${specifier}").Value;`,
  (specifier) => `const value = import("${specifier}");`,
  (specifier) => `const value = require("${specifier}");`,
  (specifier) => `import value = require("${specifier}");`,
  (specifier) => `import type Value = require("${specifier}");`,
];

test("HTTP path validation stays inside the shared production boundary", () => {
  const helper = path.join(root, "src/shared/api/path.ts");
  for (const source of ["users", "roles"])
    assert.equal(
      check(
        "../../shared/api/path.ts",
        helper,
        path.join(root, `src/features/${source}/api.ts`),
      ),
      undefined,
    );
  assert.equal(
    check(
      "../i18n/index.ts",
      path.join(root, "src/shared/i18n/index.ts"),
      helper,
    ),
    undefined,
  );
  assert.match(
    check(
      "../../features/users/api.ts",
      path.join(root, "src/features/users/api.ts"),
      helper,
    ),
    /Shared source may depend only on shared production modules/,
  );
  assert.match(
    check("node:path", path.join(root, "node_modules/node/path"), helper),
    /packages and Node builtins/,
  );
  assert.match(
    check("./path.test.ts", path.join(root, "src/shared/api/path.test.ts")),
    /published production modules/,
  );
});

test("shared source rejects every upward dependency form, including the application entrypoint", () => {
  const source = path.join(root, "src/shared/lib/error.ts");
  for (const target of [
    "src/app/contexts/Core.ts",
    "src/features/users/Users.tsx",
    "src/layouts/default/Default.tsx",
    "src/main.tsx",
  ]) {
    const resolved = path.join(root, target);
    for (const specifier of [
      "@/" + target.slice("src/".length).replace(/\.tsx?$/, ""),
      path.relative(path.dirname(source), resolved).split(path.sep).join("/"),
    ])
      for (const syntax of dependencyForms) {
        const [edge] = inspectImports(syntax(specifier));
        assert.match(
          check(edge.specifier, resolved, source, edge.typeOnly),
          /Shared source may depend only on shared production modules/,
          syntax(specifier),
        );
      }
  }
});

test("features reject another feature's UI, private helpers and barrels in every dependency form", () => {
  const source = path.join(root, "src/features/users/Users.tsx");
  for (const target of [
    "src/features/settings/Settings.tsx",
    "src/features/settings/components/logo-upload/api.ts",
    "src/features/roles/constants.ts",
    "src/features/roles/index.ts",
    "src/features/register/Register.tsx",
  ]) {
    const resolved = path.join(root, target);
    for (const specifier of [
      "@/" + target.slice("src/".length).replace(/\.tsx?$/, ""),
      path.relative(path.dirname(source), resolved).split(path.sep).join("/"),
    ])
      for (const syntax of dependencyForms) {
        const [edge] = inspectImports(syntax(specifier));
        assert.match(
          check(edge.specifier, resolved, source, edge.typeOnly),
          /Features may import another feature only through their exact approved/,
          syntax(specifier),
        );
      }
  }
  assert.match(
    check(
      "@/features/users/Users",
      path.join(root, "src/features/users/Users.tsx"),
      path.join(root, "src/features/settings/index.ts"),
    ),
    /Features may import another feature only through their exact approved/,
  );
});

test("authentication and role capabilities retain only their approved consumer and dependency kind", () => {
  for (const [source, target, typeOnly] of [
    ["src/features/account/Account.tsx", "src/features/auth/api.ts", false],
    [
      "src/features/forgot-pass/ForgotPass.tsx",
      "src/features/auth/api.ts",
      false,
    ],
    [
      "src/features/forgot-pass/ForgotPass.tsx",
      "src/features/auth/useOtpRequest.ts",
      false,
    ],
    ["src/features/login/Login.tsx", "src/features/auth/api.ts", false],
    ["src/features/register/Register.tsx", "src/features/auth/api.ts", false],
    [
      "src/features/register/Register.tsx",
      "src/features/auth/useOtpRequest.ts",
      false,
    ],
    ["src/features/users/Users.tsx", "src/features/roles/api.ts", false],
    ["src/features/account/Account.tsx", "src/features/auth/types.ts", true],
    ["src/features/account/api.ts", "src/features/auth/types.ts", true],
    ["src/features/account/types.ts", "src/features/roles/types.ts", true],
    [
      "src/features/forgot-pass/ForgotPass.tsx",
      "src/features/auth/types.ts",
      true,
    ],
    ["src/features/login/Login.tsx", "src/features/auth/types.ts", true],
    ["src/features/register/Register.tsx", "src/features/auth/types.ts", true],
    [
      "src/features/users/components/user-role-form/UserRoleForm.tsx",
      "src/features/roles/types.ts",
      true,
    ],
    ["src/features/users/types.ts", "src/features/roles/types.ts", true],
    ["src/features/users/Users.tsx", "src/features/roles/types.ts", true],
  ]) {
    const specifier = "@/" + target.slice("src/".length).replace(/\.ts$/, "");
    const owner = path.join(root, source);
    const resolved = path.join(root, target);
    assert.equal(
      check(specifier, resolved, owner, typeOnly),
      undefined,
      source,
    );
    assert.match(
      check(specifier, resolved, owner, !typeOnly),
      /(?:exact erased|Features may import another feature only through their exact approved)/,
      source,
    );
    assert.match(
      check(
        specifier,
        resolved,
        path.join(root, "src/features/settings/Settings.tsx"),
        typeOnly,
      ),
      /Features may import another feature only through their exact approved/,
      source,
    );
  }
});

test("local feature ownership, shared reuse and application composition remain valid", () => {
  for (const [source, target, typeOnly] of [
    ["src/features/users/Users.tsx", "src/features/users/api.ts", false],
    [
      "src/features/users/components/user-role-form/UserRoleForm.tsx",
      "src/features/users/types.ts",
      true,
    ],
    [
      "src/features/users/Users.tsx",
      "src/shared/hooks/useReadResource.ts",
      false,
    ],
    ["src/features/users/Users.tsx", "src/app/hooks/useCore.ts", false],
    ["src/features/users/Users.tsx", "src/app/config/routes.ts", false],
    ["src/features/users/Users.tsx", "src/app/lib/access.ts", false],
    ["src/shared/lib/error.ts", "src/shared/api/token.ts", false],
    ["src/app/Routes.tsx", "src/features/users/index.ts", false],
    ["src/layouts/default/Default.tsx", "src/features/auth/api.ts", false],
  ])
    assert.equal(
      check(
        "@/" + target.slice("src/".length).replace(/\.tsx?$/, ""),
        path.join(root, target),
        path.join(root, source),
        typeOnly,
      ),
      undefined,
      source + " -> " + target,
    );
});

test("features use app contracts without gaining access to composition, providers or layouts", () => {
  const source = path.join(root, "src/features/users/Users.tsx");
  for (const target of [
    "src/app/config/index.ts",
    "src/app/config/routes.ts",
    "src/app/hooks/index.ts",
    "src/app/hooks/useAntd.ts",
    "src/app/hooks/useCore.ts",
    "src/app/lib/index.ts",
    "src/app/lib/access.ts",
  ])
    for (const typeOnly of [false, true])
      assert.equal(
        check(
          "@/" + target.slice("src/".length).replace(/\.ts$/, ""),
          path.join(root, target),
          source,
          typeOnly,
        ),
        undefined,
        target,
      );
  for (const target of [
    "src/app/App.tsx",
    "src/app/Routes.tsx",
    "src/app/contexts/index.ts",
    "src/app/contexts/Core.ts",
    "src/app/providers/index.ts",
    "src/app/providers/core/Core.tsx",
    "src/layouts/default/Default.tsx",
    "src/main.tsx",
  ]) {
    const specifier = "@/" + target.slice("src/".length).replace(/\.tsx?$/, "");
    for (const syntax of dependencyForms) {
      const [edge] = inspectImports(syntax(specifier));
      assert.match(
        check(edge.specifier, path.join(root, target), source, edge.typeOnly),
        /Features may use only the approved app hooks, route configuration and access policy/,
        syntax(specifier),
      );
    }
  }
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
  for (const dependency of [
    "react",
    "i18next",
    "dayjs",
    "@example/translations",
  ])
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

const fixture = async (context, { source = true } = {}) => {
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
  if (source) {
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
  }
  return { directory, put };
};

const repositoryFoundation = {
  schemaVersion: 1,
  phase: "repository-foundation",
  applicationReady: false,
  allowedFiles: ["package.json", ".github/bootstrap-policy.json"],
};

test("an explicit repository foundation validates package boundaries without application source or config", async (context) => {
  const { directory, put } = await fixture(context, { source: false });
  await put(
    ".github/bootstrap-policy.json",
    JSON.stringify(repositoryFoundation),
  );

  assert.deepEqual(await checkBoundaries(directory), {
    files: 0,
    violations: [],
  });
});

test("a foundation without source still rejects workspaces, linked dependencies and multiple project roots", async (context) => {
  const { directory, put } = await fixture(context, { source: false });
  await put(
    ".github/bootstrap-policy.json",
    JSON.stringify(repositoryFoundation),
  );
  for (const manifest of [
    { workspaces: [] },
    { dependencies: { "external-backend": "1.0.0" } },
    { devDependencies: { tooling: "file:../other-project" } },
    { optionalDependencies: { tooling: "file:../other-project" } },
    { peerDependencies: { tooling: "file:../other-project" } },
    { overrides: { parent: { tooling: "file:../other-project" } } },
  ]) {
    await put("package.json", JSON.stringify(manifest));
    const result = await checkBoundaries(directory);
    assert.equal(result.files, 0);
    assert.equal(result.violations.length, 1);
    assert.match(result.violations[0], /workspaces|registry versions/);
  }
  await put("package.json", JSON.stringify({ name: "synthetic-foundation" }));
  await mkdir(path.join(directory, "packages"));
  assert.match(
    (await checkBoundaries(directory)).violations.join("\n"),
    /multi-project source directories/,
  );
});

test("a repository foundation cannot hide any unadmitted source directory", async (context) => {
  const { directory, put } = await fixture(context, { source: false });
  await put(
    ".github/bootstrap-policy.json",
    JSON.stringify(repositoryFoundation),
  );
  await mkdir(path.join(directory, "src"));
  assert.deepEqual(await checkBoundaries(directory), {
    files: 0,
    violations: [
      "The repository foundation must not contain unadmitted src source",
    ],
  });
  await put("src/hidden.js", "export const application = true;");
  assert.deepEqual(await checkBoundaries(directory), {
    files: 0,
    violations: [
      "The repository foundation must not contain unadmitted src source",
    ],
  });
});

test("source-directory casing cannot conceal application source in a repository foundation", async (context) => {
  const { directory, put } = await fixture(context, { source: false });
  await put(
    ".github/bootstrap-policy.json",
    JSON.stringify(repositoryFoundation),
  );
  await put("SRC/hidden.js", "export const application = true;");

  assert.match(
    (await checkBoundaries(directory)).violations.join("\n"),
    /must not contain unadmitted src source/,
  );
});

test("missing or contradictory publication metadata cannot bypass application boundary discovery", async (context) => {
  const { directory, put } = await fixture(context, { source: false });
  await assert.rejects(checkBoundaries(directory), /tsconfig.app.json/);
  for (const policy of [
    {},
    { ...repositoryFoundation, schemaVersion: undefined },
    { ...repositoryFoundation, phase: "foundation" },
    { ...repositoryFoundation, applicationReady: true },
    { ...repositoryFoundation, applicationReady: undefined },
    { ...repositoryFoundation, allowedFiles: undefined },
    { ...repositoryFoundation, allowedFiles: ["src/shared/api/types.ts"] },
  ]) {
    await put(".github/bootstrap-policy.json", JSON.stringify(policy));
    await assert.rejects(checkBoundaries(directory), /tsconfig.app.json/);
  }
  await put(".github/bootstrap-policy.json", "not JSON");
  await assert.rejects(checkBoundaries(directory), SyntaxError);
});

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

test("actual aliases and relative resolution cannot bypass shared or feature ownership", async (context) => {
  const { directory, put } = await fixture(context);
  await put(
    "tsconfig.app.json",
    JSON.stringify({
      compilerOptions: {
        module: "ESNext",
        moduleResolution: "bundler",
        paths: {
          "@/*": ["./src/*"],
          "@/shared/facade": ["./src/app/config/routes.ts"],
          "@/features/users/facade": ["./src/features/settings/Settings.tsx"],
        },
      },
      include: ["src/**/*.ts", "src/**/*.tsx"],
    }),
  );
  for (const target of [
    "src/app/config/routes.ts",
    "src/layouts/default/Default.tsx",
    "src/main.tsx",
    "src/features/users/api.ts",
    "src/features/roles/api.ts",
    "src/features/settings/Settings.tsx",
    "src/features/register/Register.tsx",
    "src/features/auth/api.ts",
    "src/features/auth/useOtpRequest.ts",
  ])
    await put(target, "export const Value = 1;\n");
  await put(
    "src/features/roles/types.ts",
    "export type Role = { id: string };\n",
  );
  await put(
    "src/shared/lib/error.ts",
    [
      'import type { Value } from "@/shared/facade";',
      'const page = import("../../features/users/Users");',
      'export type { Value } from "@/layouts/default/Default";',
      'const entry = require("../../main");',
      'import type { Token } from "../api/types";',
    ].join("\n"),
  );
  await put(
    "src/features/users/Users.tsx",
    [
      'import { Value as local } from "./api";',
      'import { Value as roles } from "@/features/roles/api";',
      'import type { Role } from "../roles/types";',
      'import type { Value } from "@/features/users/facade";',
      'import { Value as login } from "@/features/auth/api";',
      'export * from "../roles";',
      'const register = import("../register/Register");',
      'const otp = require("@/features/auth/useOtpRequest");',
    ].join("\n"),
  );
  await put(
    "src/features/roles/index.ts",
    [
      'export * from "./api";',
      'export * from "@/features/settings/Settings";',
    ].join("\n"),
  );

  const { violations } = await checkBoundaries(directory);
  const locations = violations.map(
    (violation) => violation.split(path.sep).join("/").split(": ")[0],
  );
  assert.deepEqual(locations.sort(), [
    "src/features/roles/index.ts:2",
    "src/features/users/Users.tsx:4",
    "src/features/users/Users.tsx:5",
    "src/features/users/Users.tsx:6",
    "src/features/users/Users.tsx:7",
    "src/features/users/Users.tsx:8",
    "src/shared/lib/error.ts:1",
    "src/shared/lib/error.ts:2",
    "src/shared/lib/error.ts:3",
    "src/shared/lib/error.ts:4",
  ]);
  for (const violation of violations)
    assert.match(
      violation,
      /(?:Shared source may depend only on shared production modules|Features may import another feature only through their exact approved)/,
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

test("the published phase retains every admitted production module", async () => {
  const result = await checkBoundaries();
  const publication = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  const production = publication.allowedFiles.filter(
    (file) =>
      file.startsWith("src/") &&
      !file.startsWith("src/test/") &&
      /\.tsx?$/.test(file) &&
      !file.endsWith(".d.ts") &&
      !file.endsWith(".stories.tsx") &&
      !/\.(?:test|spec)\./.test(file),
  );
  assert.equal(
    result.files,
    publication.applicationReady ? 122 : production.length,
  );
  assert.deepEqual(result.violations, []);
});

test("browser stories are test-only and cannot conceal production modules or become production imports", async (context) => {
  const { directory, put } = await fixture(context);
  await put(
    "src/shared/api/Example.stories.tsx",
    "export const Synthetic = {};\n",
  );
  assert.equal((await checkBoundaries(directory)).files, 1);
  await put(
    "src/shared/api/Example.stories.ts",
    "export const production = true;\n",
  );
  assert.match(
    (await checkBoundaries(directory)).violations.join("\n"),
    /Unpublished production module/,
  );
  await rm(path.join(directory, "src/shared/api/Example.stories.ts"));
  await put("src/shared/api/token.ts", 'import "./Example.stories.tsx";\n');
  assert.match(
    (await checkBoundaries(directory)).violations.join("\n"),
    /published production modules/,
  );
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
    ["src/shared/api/client.ts", "axios", "axios"],
    ["src/shared/hooks/useReadRequest.ts", "react", "react"],
    ["src/shared/ui/digits-input/DigitsInput.tsx", "react", "react"],
    ["src/app/providers/core/Core.tsx", "dayjs", "dayjs"],
    ["src/app/providers/antd/Antd.tsx", "antd/locale/fa_IR", "antd"],
    ["src/features/login/styles.ts", "antd-style", "antd-style"],
    ["src/layouts/default/Default.tsx", "lucide-react", "lucide-react"],
  ]) {
    const adapter = path.join(root, source);
    const target = path.join(root, "node_modules", dependency, "index.d.ts");
    assert.equal(
      check(specifier, target, adapter, false, dependency),
      undefined,
    );
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

test("dialog focus admits only its published helper and exact runtime or erased React owners", () => {
  const helper = path.join(root, "src/shared/lib/dialog-focus.ts");
  for (const source of [
    "src/app/hooks/useAntd.ts",
    "src/shared/ui/form-drawer/FormDrawer.tsx",
  ]) {
    const owner = path.join(root, source);
    assert.equal(check("@/shared/lib/dialog-focus", helper, owner), undefined);
    assert.match(
      check(
        "@/shared/lib/dialog-focus-internal",
        path.join(root, "src/shared/lib/dialog-focus-internal.ts"),
        owner,
      ),
      /published production modules/,
    );
  }
  const react = path.join(root, "node_modules/@types/react/index.d.ts");
  for (const [source, typeOnly] of [
    ["src/app/hooks/useAntd.ts", false],
    ["src/shared/ui/form-drawer/FormDrawer.tsx", true],
    ["src/shared/lib/dialog-focus.ts", true],
  ]) {
    const owner = path.join(root, source);
    assert.equal(
      check("react", react, owner, typeOnly, "@types/react"),
      undefined,
    );
    assert.match(
      check("react", react, owner, typeOnly, "synthetic-alias"),
      /not allowed/,
    );
    assert.match(
      check(
        "react",
        path.resolve(
          root,
          "../another-checkout/node_modules/@types/react/index.d.ts",
        ),
        owner,
        typeOnly,
        "@types/react",
      ),
      /not allowed/,
    );
    for (const dependency of [
      "axios",
      "react-dom",
      "react/internal",
      "node:fs",
    ])
      assert.match(
        check(
          dependency,
          path.join(root, "node_modules", dependency, "index.d.ts"),
          owner,
          typeOnly,
          dependency,
        ),
        /not allowed/,
      );
  }
  for (const source of [
    "src/shared/ui/form-drawer/FormDrawer.tsx",
    "src/shared/lib/dialog-focus.ts",
  ])
    assert.match(
      check("react", react, path.join(root, source), false, "@types/react"),
      /not allowed/,
    );
});

test("OTP accessibility owns only its exact React and translation runtime dependencies", () => {
  const otp = path.join(root, "src/shared/ui/otp-input/OtpInput.tsx");
  for (const dependency of ["antd", "react", "react-i18next"]) {
    const target = path.join(root, "node_modules", dependency, "index.d.ts");
    assert.equal(check(dependency, target, otp, false, dependency), undefined);
  }
  const reactTypes = path.join(root, "node_modules/@types/react/index.d.ts");
  assert.equal(
    check("react", reactTypes, otp, true, "@types/react"),
    undefined,
  );
  assert.equal(
    check("react", reactTypes, otp, false, "@types/react"),
    undefined,
  );
  for (const dependency of [
    "axios",
    "i18next",
    "react-dom",
    "react-i18next/internal",
  ]) {
    assert.match(
      check(
        dependency,
        path.join(root, "node_modules", dependency, "index.d.ts"),
        otp,
        false,
        dependency,
      ),
      /not allowed/,
    );
  }
  for (const owner of [
    "src/shared/ui/form-drawer/FormDrawer.tsx",
    "src/shared/ui/route-loading/RouteLoading.tsx",
  ])
    assert.match(
      check("react", reactTypes, path.join(root, owner), false, "@types/react"),
      /not allowed/,
    );
  assert.match(
    check(
      "react-i18next",
      path.join(root, "node_modules/react-i18next/index.d.ts"),
      path.join(root, "src/shared/ui/digits-input/DigitsInput.tsx"),
      false,
      "react-i18next",
    ),
    /not allowed/,
  );
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

test("core adapters retain exact package and erased route-vocabulary ownership", () => {
  const localeOwner = path.join(root, "src/app/providers/antd/Antd.tsx");
  const locale = path.join(root, "node_modules/antd/locale/fa_IR.d.ts");
  assert.equal(
    check("antd/locale/fa_IR", locale, localeOwner, false, "antd"),
    undefined,
  );
  for (const specifier of [
    "antd/locale/xx_XX",
    "antd/es/internal",
    "dayjs/locale/xx",
  ])
    assert.match(
      check(specifier, locale, localeOwner, false, "antd"),
      /not allowed/,
    );
  const routeOwner = path.join(root, "src/app/config/routes.ts");
  const i18next = path.join(root, "node_modules/i18next/index.d.ts");
  assert.equal(
    check("i18next", i18next, routeOwner, true, "i18next"),
    undefined,
  );
  assert.match(
    check("i18next", i18next, routeOwner, false, "i18next"),
    /not allowed/,
  );
  assert.match(
    check(
      "antd/locale/fa_IR",
      locale,
      path.join(root, "src/app/providers/core/Core.tsx"),
      false,
      "antd",
    ),
    /not allowed/,
  );
});

test("HTTP package ownership, type erasure and package identity fail closed", () => {
  const client = path.join(root, "src/shared/api/client.ts");
  const axios = path.join(root, "node_modules/axios/index.d.ts");
  const settings = path.join(root, "src/features/settings/api.ts");
  assert.equal(check("axios", axios, client, true, "axios"), undefined);
  assert.match(check("axios", axios, settings, true, "axios"), /not allowed/);
  assert.match(
    check("axios", axios, client, false, "synthetic-alias"),
    /not allowed/,
  );
  assert.match(
    check(
      "react-dom",
      path.join(root, "node_modules/react-dom/index.d.ts"),
      client,
      false,
      "react-dom",
    ),
    /not allowed/,
  );
  const hook = path.join(root, "src/shared/hooks/useReadRequest.ts");
  const reactTypes = path.join(root, "node_modules/@types/react/index.d.ts");
  assert.equal(
    check("react", reactTypes, hook, false, "@types/react"),
    undefined,
  );
  assert.match(
    check("react", reactTypes, client, false, "@types/react"),
    /not allowed/,
  );
  assert.match(
    check("react", reactTypes, hook, true, "@types/react"),
    /not allowed/,
  );
});

test("the OTP lifecycle owner admits only its exact contained runtime and erased form types", () => {
  const owner = path.join(root, "src/features/auth/useOtpRequest.ts");
  const react = path.join(root, "node_modules/@types/react/index.d.ts");
  const axios = path.join(root, "node_modules/axios/index.d.ts");
  const antd = path.join(root, "node_modules/antd/es/index.d.ts");
  assert.equal(check("react", react, owner, false, "@types/react"), undefined);
  assert.equal(check("axios", axios, owner, false, "axios"), undefined);
  assert.equal(check("antd", antd, owner, true, "antd"), undefined);
  assert.match(check("antd", antd, owner, false, "antd"), /not allowed/);
  assert.match(
    check("react", react, owner, true, "@types/react"),
    /not allowed/,
  );
  for (const dependency of ["react-dom", "react-i18next", "axios/internal"]) {
    assert.match(
      check(
        dependency,
        path.join(root, "node_modules", dependency, "index.js"),
        owner,
        false,
        dependency,
      ),
      /not allowed/,
    );
  }
  assert.match(
    check("axios", axios, owner, false, "synthetic-alias"),
    /not allowed/,
  );
});

test("the mutation lifecycle owner admits only its exact contained React and Axios dependencies", () => {
  const owner = path.join(root, "src/shared/hooks/useMutationRequest.ts");
  for (const dependency of ["react", "axios"])
    assert.equal(
      check(
        dependency,
        path.join(root, "node_modules", dependency, "index.js"),
        owner,
        false,
        dependency,
      ),
      undefined,
    );
  for (const dependency of ["antd", "react-dom", "axios/internal", "node:fs"])
    assert.match(
      check(
        dependency,
        path.join(root, "node_modules", dependency, "index.js"),
        owner,
        false,
        dependency,
      ),
      /not allowed/,
    );
  assert.match(
    check(
      "react",
      path.join(root, "node_modules", "alias", "index.js"),
      owner,
      false,
      "react",
    ),
    /not allowed/,
  );
});

test("feature wire vocabulary cannot acquire runtime imports or unrelated local types", () => {
  const settings = path.join(root, "src/features/settings/types.ts");
  const appearance = path.join(root, "src/shared/contracts/appearance.ts");
  assert.equal(
    check("../../shared/contracts/appearance.ts", appearance, settings, true),
    undefined,
  );
  assert.match(
    check("../../shared/contracts/appearance.ts", appearance, settings),
    /exact erased/,
  );
  assert.match(
    check("../../shared/api/token.ts", file, settings, true),
    /exact erased/,
  );
  for (const target of ["src/test/http-setup.ts", "src/vite-env.d.ts"])
    assert.match(
      check("./target.ts", path.join(root, target), settings, true),
      /published production/,
    );
  assert.match(
    check(
      "@/features/users/Users",
      path.join(root, "src/features/users/Users.tsx"),
      settings,
      true,
    ),
    /exact erased/,
  );
});

test("registry aliases and local dependency protocols cannot escape the standalone boundary", async (context) => {
  const { directory, put } = await fixture(context);
  for (const version of [
    "npm:other@1.0.0",
    "user/repo",
    "github:user/repo",
    "gitlab:user/repo",
    "bitbucket:user/repo",
    "ssh://git@example.test/source",
    "latest",
    "",
    "file:../source",
    "link:../source",
    "workspace:*",
    "https://example.test/source.tgz",
    "git+https://example.test/source.git",
    "../source",
    "C:/source",
  ]) {
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies",
      "overrides",
    ]) {
      await put(
        "package.json",
        JSON.stringify({
          name: "synthetic-foundation",
          [field]: { axios: version },
        }),
      );
      assert.match(
        (await checkBoundaries(directory)).violations.join("\n"),
        /(?:registry|workspaces)/,
      );
    }
    await put(
      "package.json",
      JSON.stringify({ overrides: { parent: { child: { ".": version } } } }),
    );
    assert.match(
      (await checkBoundaries(directory)).violations.join("\n"),
      /registry versions/,
    );
  }
});

test("dependency fields and nested overrides accept valid registry semver ranges", async (context) => {
  const { directory, put } = await fixture(context);
  for (const version of ["7.8.5", "^7.8.5", "~6.0.3", ">=6 <8", "7.x"]) {
    await put(
      "package.json",
      JSON.stringify({
        devDependencies: { typescript: version },
        optionalDependencies: { axios: version },
        peerDependencies: { axios: version },
        overrides: { parent: { ".": version, child: { leaf: version } } },
      }),
    );
    assert.deepEqual((await checkBoundaries(directory)).violations, []);
  }
});

test("override references must resolve to a declared registry dependency", async (context) => {
  const { directory, put } = await fixture(context);
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    await put(
      "package.json",
      JSON.stringify({
        [field]: { axios: "^1.0.0" },
        overrides: { axios: "$axios", parent: { child: "$axios" } },
      }),
    );
    assert.deepEqual((await checkBoundaries(directory)).violations, []);
  }

  for (const value of ["$missing", "$toString", null, false, 1, ["1.0.0"]]) {
    await put(
      "package.json",
      JSON.stringify({ overrides: { parent: { child: value } } }),
    );
    assert.match(
      (await checkBoundaries(directory)).violations.join("\n"),
      /registry versions/,
    );
  }
  await put(
    "package.json",
    JSON.stringify({
      optionalDependencies: { axios: "file:../other-project" },
      overrides: { parent: "$axios" },
    }),
  );
  assert.match(
    (await checkBoundaries(directory)).violations.join("\n"),
    /registry versions/,
  );
});

test("application composition admits only its explicit runtime and type package edges", () => {
  const main = path.join(root, "src/main.tsx");
  const app = path.join(root, "src/app/App.tsx");
  const routes = path.join(root, "src/app/Routes.tsx");
  assert.equal(
    check(
      "react-i18next",
      path.join(root, "node_modules/react-i18next/index.d.ts"),
      app,
      false,
      "react-i18next",
    ),
    undefined,
  );
  assert.match(
    check(
      "react-i18next",
      path.join(root, "node_modules/react-i18next/index.d.ts"),
      app,
      true,
      "react-i18next",
    ),
    /not allowed/,
  );
  for (const typeOnly of [false, true]) {
    assert.equal(
      check(
        "react",
        path.join(root, "node_modules/@types/react/index.d.ts"),
        app,
        typeOnly,
        "@types/react",
      ),
      undefined,
    );
    assert.match(
      check(
        "axios",
        path.join(root, "node_modules/axios/index.d.ts"),
        app,
        typeOnly,
        "axios",
      ),
      /not allowed/,
    );
  }
  assert.equal(
    check(
      "react-dom/client",
      path.join(root, "node_modules/@types/react-dom/client.d.ts"),
      main,
      false,
      "@types/react-dom",
    ),
    undefined,
  );
  assert.equal(
    check(
      "react-router/dom",
      path.join(root, "node_modules/react-router/dist/dom-export.d.mts"),
      routes,
      false,
      "react-router",
    ),
    undefined,
  );
  assert.match(
    check(
      "react-dom/server",
      path.join(root, "node_modules/@types/react-dom/server.d.ts"),
      main,
      false,
      "@types/react-dom",
    ),
    /not allowed/,
  );
  assert.match(
    check(
      "react-dom/client",
      path.join(root, "node_modules/unrelated/client.d.ts"),
      main,
      false,
      "@types/react-dom",
    ),
    /not allowed/,
  );
  assert.match(
    check(
      "axios",
      path.join(root, "node_modules/axios/index.d.ts"),
      routes,
      false,
      "axios",
    ),
    /not allowed/,
  );
});
