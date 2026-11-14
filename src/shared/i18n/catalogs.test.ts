import dayjs, { type Dayjs } from "dayjs";
import { afterEach, describe, expect, it } from "vitest";

import { catalogs } from "./catalogs";
import { dayjsLocaleName } from "./date";
import { faDayjs } from "./dayjs/fa";
import { localeCodes } from "./locales";

afterEach(() => {
  dayjs.calendar("gregory");
  dayjs.locale("en");
});

describe("language and calendar data", () => {
  it("retains the ten supported catalogs with a nonempty value for every English key", () => {
    expect(localeCodes).toEqual([
      "ar",
      "de",
      "en",
      "es",
      "fa",
      "fr",
      "it",
      "pt",
      "ru",
      "tr",
    ]);
    const keys = Object.keys(catalogs.en).sort();

    for (const code of localeCodes) {
      expect(Object.keys(catalogs[code]).sort(), code).toEqual(keys);
      expect(
        Object.values(catalogs[code]).every(
          (value) => typeof value === "string" && value.trim().length > 0,
        ),
        code,
      ).toBe(true);
    }
  });

  it("formats a known Nowruz date with Persian month data", () => {
    const nowruz = (
      dayjs("2026-03-21T12:00:00Z").calendar("jalali") as unknown as Dayjs
    ).locale("fa");

    expect(nowruz.format("YYYY-MM-DD")).toBe("1405-01-01");
    expect(nowruz.format("MMMM")).toBe("فروردین");
    expect(faDayjs.jmonths).toHaveLength(12);
    expect(faDayjs.jmonths[11]).toBe("اسفند");
    expect(faDayjs.weekStart).toBe(6);
  });

  it("registers a usable date locale for each UI language", () => {
    for (const code of localeCodes) {
      const date = (
        dayjs("2026-04-01T12:00:00Z").calendar("jalali") as unknown as Dayjs
      ).locale(dayjsLocaleName(code));

      expect(date.locale()).toBe(dayjsLocaleName(code));
      expect(date.format("MMMM"), code).not.toMatch(/undefined|Invalid/);
      expect(date.format("YYYY-MM-DD"), code).toBe("1405-01-12");
    }
    assert.ok(ts.isVariableStatement(statement));
    assert.ok(
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ),
    );
    assert.equal(
      statement.declarationList.flags & ts.NodeFlags.BlockScoped,
      ts.NodeFlags.Const,
    );
    assert.equal(statement.declarationList.declarations.length, 1);
    const declaration = statement.declarationList.declarations[0];
    assert.ok(ts.isIdentifier(declaration.name));
    assert.equal(declaration.name.text, code);
    const object = literalCatalogObject(declaration.initializer);
    const keys = new Set<string>();
    for (const property of object.properties) {
      assert.ok(ts.isPropertyAssignment(property));
      assert.ok(
        ts.isIdentifier(property.name) || ts.isStringLiteral(property.name),
      );
      assert.equal(keys.has(property.name.text), false);
      keys.add(property.name.text);
      assert.ok(
        ts.isStringLiteral(property.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(property.initializer),
      );
    }
    catalogs++;
  }
  assert.equal(catalogs, 1);
};
const flatCatalog = (value: unknown): Record<string, string> => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    assert.ok(typeof entry === "string", `${key} must be a root string`);
    assert.ok(entry.trim(), `${key} must contain translated text`);
    assert.ok(!key.includes("."), `${key} must not retain a nested path`);
    result[key] = entry;
  }
  return result;
};
const placeholders = (text: string) =>
  [
    ...new Set(
      [...text.matchAll(/\{\{\s*-?\s*([\w.]+)(?:\s*,[^}]*)?\s*\}\}/g)].map(
        (match) => match[1],
      ),
    ),
  ].sort();
const parity = (
  reference: Record<string, string>,
  messages: Record<string, string>,
  locale: string,
) => {
  assert.deepEqual(
    Object.keys(messages).sort(),
    Object.keys(reference).sort(),
    locale,
  );
  for (const key of Object.keys(reference))
    assert.deepEqual(
      placeholders(messages[key]),
      placeholders(reference[key]),
      `${locale}:${key}`,
    );
};
const filesUnder = async (directory: string): Promise<string[]> =>
  (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) => {
        const filename = path.join(directory, entry.name);
        return entry.isDirectory() ? filesUnder(filename) : [filename];
      }),
    )
  ).flat();

test("all ten local admin catalogs contain complete nonempty keys and interpolation", () => {
  assert.equal(localeCodes.length, 10);
  assert.deepEqual(Object.keys(catalogs).sort(), [...localeCodes].sort());
  const english = flatCatalog(catalogs.en);
  assert.equal(Object.keys(english).length, 162);
  for (const code of localeCodes)
    parity(english, flatCatalog(catalogs[code]), code);
});

test("reused UI meanings are root keys without a common object or aliases", () => {
  for (const code of localeCodes) {
    assert.equal(Object.hasOwn(catalogs[code], "common"), false);
    for (const key of [
      "account",
      "login",
      "password",
      "networkError",
      "requiredField",
    ] as const)
      assert.ok(catalogs[code][key].trim());
  }
});

test("the catalog registry uses each language's single canonical data object", async () => {
  for (const code of localeCodes) {
    const module = await import(`./locales/${code}.ts`);
    const language = module[code];
    assert.strictEqual(catalogs[code], language);
    const original = language.login;
    try {
      Reflect.set(language, "login", "Synthetic test label");
      assert.equal(catalogs[code].login, "Synthetic test label");
    } finally {
      Reflect.set(language, "login", original);
    }
  }
});

test("published source and test callers do not use retired common-prefixed lookups", async () => {
  const repository = path.resolve(source, "../../..");
  const files = [...(await filesUnder(path.join(repository, "src")))].filter(
    (file) =>
      /\.[cm]?[jt]sx?$/.test(file) && file !== fileURLToPath(import.meta.url),
  );
  for (const file of files)
    assert.doesNotMatch(
      await readFile(file, "utf8"),
      /["'`]common\.[A-Za-z]\w*["'`]|\.common\b/,
      path.relative(repository, file),
    );
});

test("each language owns translated core messages rather than an English placeholder catalog", () => {
  for (const code of localeCodes) {
    if (code === "en") continue;
    assert.notStrictEqual(catalogs[code], catalogs.en);
    assert.notEqual(catalogs[code].networkError, catalogs.en.networkError);
    assert.notEqual(catalogs[code].login, catalogs.en.login);
  }
});

test("language leaf modules contain literal string data and erased types without executable logic", async () => {
  for (const code of localeCodes)
    assertLiteralCatalogModule(
      await readFile(path.join(source, "locales", `${code}.ts`), "utf8"),
      code,
    );
});

test("the literal-data guard accepts erased wrappers and type declarations", () => {
  for (const content of [
    'export const fa = { login: "ورود" } as const;',
    'import type { TranslationCatalog } from "./en.ts"; export const fa = { login: "ورود" } satisfies TranslationCatalog;',
    "export const fa = ({ login: `ورود` }); export type Catalog = typeof fa;",
  ])
    assert.doesNotThrow(() => assertLiteralCatalogModule(content, "fa"));
});

test("the literal-data guard rejects spreads, helpers, calls and computed catalog content", () => {
  for (const content of [
    'import { en } from "./en.ts"; export const fa = { login: "ورود" };',
    'import { type TranslationCatalog } from "./en.ts"; export const fa = { login: "ورود" };',
    'import "./runtime.ts"; export const fa = { login: "ورود" };',
    'export const fa = { ...en, login: "ورود" };',
    'const helper = () => "ورود"; export const fa = { login: helper() };',
    'export function helper() {} export const fa = { login: "ورود" };',
    'export const fa = (() => ({ login: "ورود" }))();',
    'export const fa = { login: translate("login") };',
    'export const fa = { ["login"]: "ورود" };',
    'export const fa = { get login() { return "ورود"; } };',
    'export const fa = { login() { return "ورود"; } };',
    "export const fa = { login };",
    'export const fa = { login: { value: "ورود" } };',
    "export const fa = { login: `Hello ${user}` };",
    'export const fa = { login: "ورود", login: "دوباره" };',
    'export let fa = { login: "ورود" };',
    'export using fa = { login: "ورود" };',
    'export await using fa = { login: "ورود" };',
    'export const fa = { login: "ورود" }, helper = () => {};',
    'export const fa = { login: "ورود" }; sideEffect();',
  ])
    assert.throws(() => assertLiteralCatalogModule(content, "fa"));
});

test("Persian calendar data preserves weekdays, months and relative time", () => {
  assert.equal(faDayjs.name, "fa");
  assert.equal(faDayjs.weekStart, 6);
  for (const weekdays of [
    faDayjs.weekdays,
    faDayjs.weekdaysShort,
    faDayjs.weekdaysMin,
  ]) {
    assert.equal(weekdays.length, 7);
    assert.ok(weekdays.every((value) => value.trim()));
  }
  assert.equal(faDayjs.months.length, 12);
  assert.equal(faDayjs.jmonths.length, 12);
  assert.equal(faDayjs.months[0], "ژانویه");
  assert.equal(faDayjs.jmonths[0], "فروردین");
  assert.notDeepEqual(faDayjs.jmonths, faDayjs.months);
  assert.deepEqual(faDayjs.monthsShort, faDayjs.months);
  assert.equal(faDayjs.formats.L, "DD/MM/YYYY");
  assert.ok(faDayjs.relativeTime.future.includes("%s"));
  assert.ok(faDayjs.relativeTime.past.includes("%s"));
  assert.equal(faDayjs.ordinal(21), 21);
});

test("local catalog modules stay pure while runtime initialization stays in the adapter", async () => {
  const files = [
    "catalogs.ts",
    "locales.ts",
    ...(await filesUnder(path.join(source, "locales"))).map((file) =>
      path.relative(source, file),
    ),
    ...(await filesUnder(path.join(source, "dayjs"))).map((file) =>
      path.relative(source, file),
    ),
  ];
  const violations: string[] = [];
  for (const filename of files) {
    const fullPath = path.join(source, filename);
    const module = ts.createSourceFile(
      fullPath,
      await readFile(fullPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const check = (specifier: string) => {
      const target = path.relative(
        source,
        path.resolve(path.dirname(fullPath), specifier),
      );
      if (
        !specifier.startsWith(".") ||
        target.startsWith("..") ||
        path.isAbsolute(target)
      )
        violations.push(`${filename}: ${specifier}`);
    };
    const visit = (node: ts.Node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      )
        check(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require"))
      ) {
        const specifier = node.arguments[0];
        check(
          specifier && ts.isStringLiteralLike(specifier)
            ? specifier.text
            : "[computed]",
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(module);
  }
  assert.deepEqual(violations, []);
});

test("one code-named file per language agrees with the supported-code registry", async () => {
  const expected = [...localeCodes].sort();
  assert.deepEqual(
    (await readdir(path.join(source, "locales"), { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort(),
    expected.map((code) => `${code}.ts`),
  );
  const entries = await readdir(path.join(source, "locales"), {
    withFileTypes: true,
  });
});
