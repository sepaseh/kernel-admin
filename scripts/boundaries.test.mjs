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

test("the Storybook phase retains all measured production modules", async () => {
  const result = await checkBoundaries();
  assert.equal(result.files, 122);
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
    for (const field of ["dependencies", "devDependencies"]) {
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
  }
});

test("development tooling accepts valid registry semver ranges", async (context) => {
  const { directory, put } = await fixture(context);
  for (const version of ["7.8.5", "^7.8.5", "~6.0.3", ">=6 <8", "7.x"]) {
    await put(
      "package.json",
      JSON.stringify({ devDependencies: { typescript: version } }),
    );
    assert.deepEqual((await checkBoundaries(directory)).violations, []);
  }
});

test("application composition admits only its explicit runtime and type package edges", () => {
  const main = path.join(root, "src/main.tsx");
  const routes = path.join(root, "src/app/Routes.tsx");
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
