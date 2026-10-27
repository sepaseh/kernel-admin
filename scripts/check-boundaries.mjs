import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const repository = fileURLToPath(new URL("../", import.meta.url));
const productionPaths = [
  "src/shared/api/token.ts",
  "src/shared/api/types.ts",
  "src/shared/contracts/index.ts",
  "src/shared/i18n/catalogs.ts",
  "src/shared/i18n/locales.ts",
  "src/shared/i18n/dayjs/fa.ts",
  ...["ar", "de", "en", "es", "fa", "fr", "it", "pt", "ru", "tr"].map(
    (code) => `src/shared/i18n/locales/${code}.ts`,
  ),
  "src/shared/lib/transform.ts",
  "src/shared/lib/color-contrast.ts",
];
const publishedModules = (root) =>
  new Set(productionPaths.map((file) => path.join(root, file)));
const isErasedTypeReference = (node) => {
  if (ts.isImportTypeNode(node)) return true;
  if (ts.isImportDeclaration(node))
    return node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword;
  if (ts.isExportDeclaration(node) || ts.isImportEqualsDeclaration(node))
    return node.isTypeOnly;
  return false;
};
export const inspectImports = (content, filename = "source.ts") => {
  const source = ts.createSourceFile(
    filename,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = [];
  const add = (node, value) =>
    imports.push({
      specifier:
        value && ts.isStringLiteralLike(value) ? value.text : undefined,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      typeOnly: isErasedTypeReference(node),
    });
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      add(node, node.moduleSpecifier);
    } else if (ts.isImportTypeNode(node)) {
      add(
        node,
        ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined,
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node, node.moduleReference.expression);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      add(node, node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
};

export const boundaryViolation = ({
  root,
  file,
  specifier,
  resolved,
  typeOnly,
}) => {
  if (!specifier)
    return "Use literal module paths so source boundaries can be checked";
  if (!specifier.startsWith(".") && !specifier.startsWith("@/"))
    return "Pure source imports must use published local production modules; packages and Node builtins are not allowed";

  if (!resolved || !publishedModules(root).has(path.resolve(resolved)))
    return "Pure source imports must resolve to published production modules in this repository";

  const contracts = path.join(root, "src/shared/contracts");
  if (path.dirname(file) === contracts && path.dirname(resolved) !== contracts)
    return "Wire contracts must depend only on local pure contract modules";
  const catalogs = path.join(root, "src/shared/i18n") + path.sep;
  if (file.startsWith(catalogs) && !resolved.startsWith(catalogs))
    return "Catalog data must depend only on its published pure local modules";
  const data =
    file === path.join(catalogs, "locales.ts") ||
    file.startsWith(path.join(catalogs, "locales") + path.sep) ||
    file.startsWith(path.join(catalogs, "dayjs") + path.sep);
  if (data && !typeOnly)
    return "Catalog and calendar data dependencies must be fully erased type references";

  return undefined;
};

const sourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      if (entry.isSymbolicLink())
        throw new Error("Published source must not contain symbolic links");

      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(filename);

      return entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !/\.(?:test|spec)\./.test(entry.name)
        ? [filename]
        : [];
    }),
  );
  return files.flat();
};

export const checkBoundaries = async (requestedRoot = repository) => {
  const root = await realpath(requestedRoot);
  const manifest = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  const violations = [];
  if (
    Object.hasOwn(manifest, "workspaces") ||
    Object.keys(manifest.dependencies ?? {}).length > 0
  )
    violations.push(
      "The published pure phase must use one root package without runtime dependencies or workspaces",
    );

  const entries = await readdir(root);
  if (entries.some((entry) => ["apps", "packages"].includes(entry)))
    violations.push(
      "The standalone project must not contain multi-project source directories",
    );

  const config = ts.readConfigFile(
    path.join(root, "tsconfig.app.json"),
    ts.sys.readFile,
  );
  if (config.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
    );

  const { options, errors } = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    root,
  );
  if (errors.length)
    throw new Error(
      errors
        .map((error) =>
          ts.flattenDiagnosticMessageText(error.messageText, "\n"),
        )
        .join("\n"),
    );

  const cache = ts.createModuleResolutionCache(root, (value) => value, options);
  const allowed = publishedModules(root);
  const files = await sourceFiles(path.join(root, "src"));
  const found = await Promise.all(
    files.map(async (file) => {
      if (!allowed.has(await realpath(file)))
        return ["Unpublished production module: " + path.relative(root, file)];

      const edges = inspectImports(await readFile(file, "utf8"), file);
      const failures = await Promise.all(
        edges.map(async (edge) => {
          const module =
            edge.specifier &&
            ts.resolveModuleName(edge.specifier, file, options, ts.sys, cache)
              .resolvedModule;
          const resolved = module && (await realpath(module.resolvedFileName));
          const violation = boundaryViolation({
            root,
            file,
            specifier: edge.specifier,
            resolved,
            typeOnly: edge.typeOnly,
          });
          return violation
            ? path.relative(root, file) + ":" + edge.line + ": " + violation
            : undefined;
        }),
      );
      return failures.filter((value) => value !== undefined);
    }),
  );
  violations.push(...found.flat());
  return { files: files.length, violations };
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await checkBoundaries();
  if (result.violations.length) {
    console.error(result.violations.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      "Closed admin source boundaries checked: " +
        result.files +
        " production modules.",
    );
}
