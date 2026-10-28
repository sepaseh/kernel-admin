import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import semver from "semver";
import ts from "typescript";

const repository = fileURLToPath(new URL("../", import.meta.url));
const productionPaths = [
  "src/app/config/index.ts",
  "src/app/config/routes.ts",
  "src/app/contexts/Core.ts",
  "src/app/contexts/index.ts",
  "src/app/hooks/index.ts",
  "src/app/hooks/useAntd.ts",
  "src/app/hooks/useCore.ts",
  "src/app/lib/access.ts",
  "src/app/lib/index.ts",
  "src/app/not-found/NotFound.tsx",
  "src/app/providers/antd/Antd.tsx",
  "src/app/providers/core/Core.tsx",
  "src/app/providers/core/SettingsFeedback.tsx",
  "src/app/providers/index.ts",
  "src/features/account/Account.tsx",
  "src/features/account/api.ts",
  "src/features/account/index.ts",
  "src/features/account/types.ts",
  "src/features/auth/api.ts",
  "src/features/auth/index.ts",
  "src/features/auth/types.ts",
  "src/features/auth/useOtpRequest.ts",
  "src/features/calendar/Calendar.tsx",
  "src/features/calendar/api.ts",
  "src/features/calendar/index.ts",
  "src/features/calendar/styles.ts",
  "src/features/dashboard/Dashboard.tsx",
  "src/features/dashboard/index.ts",
  "src/features/forgot-pass/ForgotPass.tsx",
  "src/features/forgot-pass/index.ts",
  "src/features/login/Login.tsx",
  "src/features/login/index.ts",
  "src/features/login/styles.ts",
  "src/features/register/Register.tsx",
  "src/features/register/index.ts",
  "src/features/roles/Roles.tsx",
  "src/features/roles/api.ts",
  "src/features/roles/components/role-form/RoleForm.tsx",
  "src/features/roles/constants.ts",
  "src/features/roles/index.ts",
  "src/features/roles/types.ts",
  "src/features/settings/Settings.tsx",
  "src/features/settings/api.ts",
  "src/features/settings/components/logo-upload/LogoUpload.tsx",
  "src/features/settings/components/logo-upload/api.ts",
  "src/features/settings/components/logo-upload/index.ts",
  "src/features/settings/index.ts",
  "src/features/settings/types.ts",
  "src/features/users/Users.tsx",
  "src/features/users/api.ts",
  "src/features/users/components/user-form/UserForm.tsx",
  "src/features/users/components/user-role-form/UserRoleForm.tsx",
  "src/features/users/constants.ts",
  "src/features/users/hooks/useDebouncedFilters.ts",
  "src/features/users/hooks/useFilterParams.ts",
  "src/features/users/index.ts",
  "src/features/users/tools/password.ts",
  "src/features/users/types.ts",
  "src/layouts/auth/Auth.tsx",
  "src/layouts/auth/index.ts",
  "src/layouts/default/Default.tsx",
  "src/layouts/default/index.ts",
  "src/shared/api/client.ts",
  "src/shared/api/config.ts",
  "src/shared/api/index.ts",
  "src/shared/api/token-response.ts",
  "src/shared/api/token.ts",
  "src/shared/api/types.ts",
  "src/shared/config/constants.ts",
  "src/shared/config/index.ts",
  "src/shared/config/language.ts",
  "src/shared/config/theme.ts",
  "src/shared/contracts/appearance.ts",
  "src/shared/contracts/index.ts",
  "src/shared/hooks/index.ts",
  "src/shared/hooks/useGoBack.ts",
  "src/shared/hooks/useMutationRequest.ts",
  "src/shared/hooks/useReadRequest.ts",
  "src/shared/hooks/useReadResource.ts",
  "src/shared/i18n/catalogs.ts",
  "src/shared/i18n/date.ts",
  "src/shared/i18n/dayjs/fa.ts",
  "src/shared/i18n/index.ts",
  "src/shared/i18n/locales.ts",
  "src/shared/i18n/locales/ar.ts",
  "src/shared/i18n/locales/de.ts",
  "src/shared/i18n/locales/en.ts",
  "src/shared/i18n/locales/es.ts",
  "src/shared/i18n/locales/fa.ts",
  "src/shared/i18n/locales/fr.ts",
  "src/shared/i18n/locales/it.ts",
  "src/shared/i18n/locales/pt.ts",
  "src/shared/i18n/locales/ru.ts",
  "src/shared/i18n/locales/tr.ts",
  "src/shared/lib/color-contrast.ts",
  "src/shared/lib/error.ts",
  "src/shared/lib/index.ts",
  "src/shared/lib/observability.ts",
  "src/shared/lib/transform.ts",
  "src/shared/storage/compact.ts",
  "src/shared/storage/hooks/useLocalStorageWatcher.ts",
  "src/shared/storage/index.ts",
  "src/shared/storage/state.ts",
  "src/shared/storage/theme.ts",
  "src/shared/ui/digits-input/DigitsInput.tsx",
  "src/shared/ui/digits-input/index.ts",
  "src/shared/ui/error-boundary/ErrorBoundary.tsx",
  "src/shared/ui/error-boundary/index.ts",
  "src/shared/ui/form-drawer/FormDrawer.tsx",
  "src/shared/ui/form-drawer/index.ts",
  "src/shared/ui/otp-input/OtpInput.tsx",
  "src/shared/ui/otp-input/index.ts",
  "src/shared/ui/password-fields/PasswordFields.tsx",
  "src/shared/ui/password-fields/index.ts",
  "src/shared/ui/request-feedback/RequestFeedback.tsx",
  "src/shared/ui/request-feedback/index.ts",
  "src/shared/ui/route-loading/RouteLoading.tsx",
  "src/shared/ui/route-loading/index.ts",
];
const runtimeImports = {
  "src/app/contexts/Core.ts": ["react"],
  "src/app/hooks/useAntd.ts": ["antd"],
  "src/app/hooks/useCore.ts": ["react"],
  "src/app/not-found/NotFound.tsx": ["antd", "react-i18next", "react-router"],
  "src/app/providers/antd/Antd.tsx": [
    "antd",
    "antd/locale/ar_EG",
    "antd/locale/de_DE",
    "antd/locale/en_GB",
    "antd/locale/es_ES",
    "antd/locale/fa_IR",
    "antd/locale/fr_FR",
    "antd/locale/it_IT",
    "antd/locale/pt_PT",
    "antd/locale/ru_RU",
    "antd/locale/tr_TR",
    "react",
  ],
  "src/app/providers/core/Core.tsx": ["dayjs", "react"],
  "src/features/auth/useOtpRequest.ts": ["axios", "react"],
  "src/features/forgot-pass/ForgotPass.tsx": [
    "antd",
    "axios",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/login/Login.tsx": [
    "antd",
    "axios",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/login/styles.ts": ["antd-style"],
  "src/features/register/Register.tsx": [
    "antd",
    "axios",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/layouts/auth/Auth.tsx": ["antd-style", "react", "react-router"],
  "src/layouts/default/Default.tsx": [
    "antd",
    "antd-style",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/shared/config/theme.ts": ["antd"],
  "src/shared/hooks/useGoBack.ts": ["react", "react-router"],
  "src/shared/lib/observability.ts": ["web-vitals"],
  "src/shared/storage/hooks/useLocalStorageWatcher.ts": ["react"],
  "src/shared/ui/digits-input/DigitsInput.tsx": ["antd", "react"],
  "src/shared/ui/error-boundary/ErrorBoundary.tsx": [
    "antd",
    "react",
    "react-i18next",
  ],
  "src/shared/ui/form-drawer/FormDrawer.tsx": ["antd", "react-i18next"],
  "src/shared/ui/otp-input/OtpInput.tsx": ["antd", "react", "react-i18next"],
  "src/shared/ui/password-fields/PasswordFields.tsx": ["antd", "react-i18next"],
  "src/shared/ui/request-feedback/RequestFeedback.tsx": [
    "antd",
    "react-i18next",
  ],
  "src/shared/ui/route-loading/RouteLoading.tsx": ["antd", "react-i18next"],
  "src/features/auth/api.ts": ["axios"],
  "src/shared/api/client.ts": ["axios"],
  "src/shared/hooks/useReadRequest.ts": ["axios", "react"],
  "src/shared/hooks/useReadResource.ts": ["react"],
  "src/shared/i18n/index.ts": ["i18next", "react-i18next"],
  "src/shared/i18n/date.ts": [
    "dayjs",
    "jalaliday",
    "dayjs/plugin/calendar",
    ...["ar", "de", "en-gb", "es", "fr", "it", "pt", "ru", "tr"].map(
      (code) => "dayjs/locale/" + code,
    ),
  ],
  "src/features/account/Account.tsx": [
    "antd",
    "antd-style",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/account/index.ts": [],
  "src/features/calendar/Calendar.tsx": [
    "antd",
    "dayjs",
    "lucide-react",
    "react",
    "react-i18next",
  ],
  "src/features/calendar/index.ts": [],
  "src/features/calendar/styles.ts": ["antd-style"],
  "src/features/dashboard/Dashboard.tsx": ["antd-style"],
  "src/features/dashboard/index.ts": [],
  "src/features/roles/Roles.tsx": [
    "antd",
    "antd-style",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/roles/components/role-form/RoleForm.tsx": [
    "antd",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/roles/constants.ts": [],
  "src/features/roles/index.ts": [],
  "src/features/settings/Settings.tsx": ["antd", "react", "react-i18next"],
  "src/features/settings/components/logo-upload/LogoUpload.tsx": [
    "antd",
    "antd-style",
    "lucide-react",
    "react",
    "react-i18next",
  ],
  "src/features/settings/components/logo-upload/index.ts": [],
  "src/features/settings/index.ts": [],
  "src/features/users/Users.tsx": [
    "antd",
    "antd-style",
    "lucide-react",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/users/components/user-form/UserForm.tsx": [
    "antd",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/users/components/user-role-form/UserRoleForm.tsx": [
    "antd",
    "react",
    "react-i18next",
    "react-router",
  ],
  "src/features/users/constants.ts": [],
  "src/features/users/hooks/useDebouncedFilters.ts": ["react"],
  "src/features/users/hooks/useFilterParams.ts": ["react", "react-router"],
  "src/features/users/index.ts": [],
  "src/features/users/tools/password.ts": [],
  "src/shared/hooks/useMutationRequest.ts": ["axios", "react"],
};
const typeImports = {
  "src/app/config/routes.ts": ["i18next"],
  "src/app/providers/antd/Antd.tsx": ["antd", "react"],
  "src/app/providers/core/Core.tsx": ["react"],
  "src/features/auth/useOtpRequest.ts": ["antd"],
  "src/features/forgot-pass/ForgotPass.tsx": ["antd"],
  "src/features/login/Login.tsx": ["antd"],
  "src/features/register/Register.tsx": ["antd"],
  "src/layouts/default/Default.tsx": ["antd"],
  "src/shared/config/theme.ts": ["antd"],
  "src/shared/hooks/useGoBack.ts": ["react-router"],
  "src/shared/lib/observability.ts": ["web-vitals"],
  "src/shared/ui/digits-input/DigitsInput.tsx": ["antd"],
  "src/shared/ui/otp-input/OtpInput.tsx": ["react"],
  "src/shared/api/client.ts": ["axios"],
  "src/features/account/Account.tsx": [],
  "src/features/account/index.ts": [],
  "src/features/calendar/Calendar.tsx": ["antd", "react"],
  "src/features/calendar/index.ts": [],
  "src/features/calendar/styles.ts": [],
  "src/features/dashboard/Dashboard.tsx": [],
  "src/features/dashboard/index.ts": [],
  "src/features/roles/Roles.tsx": ["antd"],
  "src/features/roles/components/role-form/RoleForm.tsx": [],
  "src/features/roles/constants.ts": [],
  "src/features/roles/index.ts": [],
  "src/features/settings/Settings.tsx": ["antd"],
  "src/features/settings/components/logo-upload/LogoUpload.tsx": ["antd"],
  "src/features/settings/components/logo-upload/index.ts": [],
  "src/features/settings/index.ts": [],
  "src/features/users/Users.tsx": ["antd"],
  "src/features/users/components/user-form/UserForm.tsx": [],
  "src/features/users/components/user-role-form/UserRoleForm.tsx": [],
  "src/features/users/constants.ts": [],
  "src/features/users/hooks/useDebouncedFilters.ts": [],
  "src/features/users/hooks/useFilterParams.ts": [],
  "src/features/users/index.ts": [],
  "src/features/users/tools/password.ts": [],
  "src/shared/hooks/useMutationRequest.ts": [],
};
const wireImports = {
  "src/features/auth/types.ts": [],
  "src/features/account/types.ts": ["src/features/roles/types.ts"],
  "src/features/roles/types.ts": [],
  "src/features/users/types.ts": ["src/features/roles/types.ts"],
  "src/features/settings/types.ts": [
    "src/shared/config/language.ts",
    "src/shared/contracts/appearance.ts",
  ],
};
const runtimeDependencies = new Set([
  "antd-style",
  "lucide-react",
  "antd",
  "react-router",
  "web-vitals",
  "axios",
  "react-dom",
  "dayjs",
  "i18next",
  "jalaliday",
  "react",
  "react-i18next",
]);
const runtimePaths = new Set([
  "src/shared/config/language.ts",
  "src/shared/i18n/index.ts",
  "src/shared/i18n/date.ts",
  "src/shared/lib/error.ts",
]);
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

const localSourceViolation = ({
  root,
  file,
  resolved,
  typeOnly,
  relativeFile,
}) => {
  const target = path.relative(root, resolved).split(path.sep).join("/");
  if (
    Object.hasOwn(wireImports, relativeFile) &&
    (!typeOnly || !wireImports[relativeFile].includes(target))
  )
    return "Owned HTTP types may import only their exact erased local wire vocabulary";
  const contracts = path.join(root, "src/shared/contracts");
  if (path.dirname(file) === contracts && path.dirname(resolved) !== contracts)
    return "Wire contracts must depend only on local pure contract modules";
  const catalogs = path.join(root, "src/shared/i18n") + path.sep;
  if (
    file.startsWith(catalogs) &&
    !runtimePaths.has(relativeFile) &&
    (!resolved.startsWith(catalogs) || runtimePaths.has(target))
  )
    return "Catalog data must depend only on its published pure local modules";
  const data =
    file === path.join(catalogs, "locales.ts") ||
    file.startsWith(path.join(catalogs, "locales") + path.sep) ||
    file.startsWith(path.join(catalogs, "dayjs") + path.sep);
  if (data && !typeOnly)
    return "Catalog and calendar data dependencies must be fully erased type references";
  return undefined;
};

const dependencyPackageName = (specifier, resolvedPackage) => {
  if (specifier === "react" && resolvedPackage === "@types/react")
    return "@types/react";
  if (specifier.startsWith("dayjs/")) return "dayjs";
  if (specifier.startsWith("antd/locale/")) return "antd";
  return specifier;
};

const packageImportViolation = ({
  root,
  relativeFile,
  specifier,
  resolved,
  typeOnly,
  resolvedPackage,
}) => {
  const imports = typeOnly ? typeImports : runtimeImports;
  const packageName = dependencyPackageName(specifier, resolvedPackage);
  const packageRoot = path.join(root, "node_modules", packageName) + path.sep;
  if (
    imports[relativeFile]?.includes(specifier) &&
    resolvedPackage === packageName &&
    resolved?.startsWith(packageRoot)
  )
    return undefined;
  return "Pure source imports must use published local production modules; packages and Node builtins are not allowed except exact contained runtime-adapter dependencies";
};

export const boundaryViolation = ({
  root,
  file,
  specifier,
  resolved,
  typeOnly,
  resolvedPackage,
}) => {
  if (!specifier)
    return "Use literal module paths so source boundaries can be checked";
  const relativeFile = path.relative(root, file).split(path.sep).join("/");
  if (!specifier.startsWith(".") && !specifier.startsWith("@/"))
    return packageImportViolation({
      root,
      relativeFile,
      specifier,
      resolved,
      typeOnly,
      resolvedPackage,
    });
  if (!resolved || !publishedModules(root).has(path.resolve(resolved)))
    return "Pure source imports must resolve to published production modules in this repository";
  return localSourceViolation({ root, file, resolved, typeOnly, relativeFile });
};

const sourceFiles = async (directory, testRoot) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      if (entry.isSymbolicLink())
        throw new Error("Published source must not contain symbolic links");

      const filename = path.join(directory, entry.name);
      if (entry.isDirectory())
        return filename === testRoot ? [] : sourceFiles(filename, testRoot);

      return entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !entry.name.endsWith(".d.ts") &&
        !entry.name.endsWith(".stories.tsx") &&
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
    Object.keys(manifest.dependencies ?? {}).some(
      (dependency) => !runtimeDependencies.has(dependency),
    ) ||
    Object.values(manifest.dependencies ?? {}).some(
      (version) =>
        typeof version !== "string" || !/^\^?\d+\.\d+\.\d+$/.test(version),
    )
  )
    violations.push(
      "The published phase must use one root package with only declared registry runtime dependencies and no workspaces",
    );
  if (
    Object.values(manifest.devDependencies ?? {}).some(
      (version) =>
        typeof version !== "string" ||
        !version.trim() ||
        semver.validRange(version) === null,
    )
  )
    violations.push(
      "Development dependencies must use registry versions without aliases or local source links",
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
  const files = await sourceFiles(
    path.join(root, "src"),
    path.join(root, "src/test"),
  );
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
            resolvedPackage: module?.packageId?.name,
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
