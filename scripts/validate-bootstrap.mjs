import { spawnSync } from "node:child_process";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const policyPath = ".github/bootstrap-policy.json";
const coreFiles = [
  policyPath,
  ".github/workflows/pr-policy.yml",
  "scripts/check-pr-size.mjs",
  "scripts/check-pr-size.test.mjs",
  "scripts/validate-bootstrap.mjs",
  "scripts/validate-bootstrap.test.mjs",
];
const foundationFiles = [
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
const foundationSources = new Set([
  "src/shared/api/token.ts",
  "src/shared/api/token.test.ts",
  "src/shared/api/types.ts",
  "src/shared/contracts/index.ts",
  "src/shared/lib/transform.ts",
  "src/shared/lib/transform.test.ts",
  "src/shared/lib/color-contrast.ts",
  "src/shared/lib/color-contrast.test.ts",
]);
const isFoundationSource = (file) => foundationSources.has(file);
const catalogFiles = [
  "src/shared/i18n/catalogs.ts",
  "src/shared/i18n/catalogs.test.ts",
  "src/shared/i18n/locales.ts",
  "src/shared/i18n/dayjs/fa.ts",
  ...["ar", "de", "en", "es", "fa", "fr", "it", "pt", "ru", "tr"].map(
    (code) => `src/shared/i18n/locales/${code}.ts`,
  ),
];
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
const httpFiles = [
  "src/features/account/api.test.ts",
  "src/features/account/api.ts",
  "src/features/account/types.ts",
  "src/features/auth/api.test.ts",
  "src/features/auth/api.ts",
  "src/features/auth/index.ts",
  "src/features/auth/logout.test.ts",
  "src/features/auth/types.ts",
  "src/features/calendar/api.test.ts",
  "src/features/calendar/api.ts",
  "src/features/roles/api.test.ts",
  "src/features/roles/api.ts",
  "src/features/roles/types.ts",
  "src/features/settings/api.test.ts",
  "src/features/settings/api.ts",
  "src/features/settings/components/logo-upload/api.test.ts",
  "src/features/settings/components/logo-upload/api.ts",
  "src/features/settings/types.ts",
  "src/features/users/api.helpers.test.ts",
  "src/features/users/api.test.ts",
  "src/features/users/api.ts",
  "src/features/users/types.ts",
  "src/shared/api/client.test.ts",
  "src/shared/api/client.ts",
  "src/shared/api/config.test.ts",
  "src/shared/api/config.ts",
  "src/shared/api/index.ts",
  "src/shared/api/token-response.test.ts",
  "src/shared/api/token-response.ts",
  "src/shared/api/transport.test.ts",
  "src/shared/contracts/appearance.test.ts",
  "src/shared/contracts/appearance.ts",
  "src/shared/hooks/useReadRequest.ts",
  "src/shared/hooks/useReadResource.test.ts",
  "src/shared/hooks/useReadResource.ts",
  "src/test/http-setup.ts",
  "src/test/mocks/handlers.ts",
  "src/test/mocks/server.ts",
  "src/vite-env.d.ts",
  "docs/http-client.md",
  "docs/http-client.fa.md",
  "docs/request-lifecycle.md",
  "docs/request-lifecycle.fa.md",
];
const uiFiles = [
  "docs/ui-foundation.fa.md",
  "docs/ui-foundation.md",
  "public/favicon.svg",
  "public/logo.svg",
  "src/assets/assets.test.ts",
  "src/assets/fonts/vazirmatn/OFL.txt",
  "src/assets/fonts/vazirmatn/Vazirmatn-Variable.woff2",
  "src/assets/styles/index.css",
  "src/assets/styles/vazirmatn.css",
  "src/shared/config/constants.ts",
  "src/shared/config/index.ts",
  "src/shared/config/theme.test.ts",
  "src/shared/config/theme.ts",
  "src/shared/hooks/index.ts",
  "src/shared/hooks/useGoBack.test.tsx",
  "src/shared/hooks/useGoBack.ts",
  "src/shared/lib/index.ts",
  "src/shared/lib/observability.test.ts",
  "src/shared/lib/observability.ts",
  "src/shared/lib/observability.vitals.test.ts",
  "src/shared/storage/compact.ts",
  "src/shared/storage/hooks/useLocalStorageWatcher.test.ts",
  "src/shared/storage/hooks/useLocalStorageWatcher.ts",
  "src/shared/storage/index.ts",
  "src/shared/storage/preferences.test.ts",
  "src/shared/storage/state.test.ts",
  "src/shared/storage/state.ts",
  "src/shared/storage/theme.ts",
  "src/shared/ui/digits-input/DigitsInput.test.tsx",
  "src/shared/ui/digits-input/DigitsInput.tsx",
  "src/shared/ui/digits-input/index.ts",
  "src/shared/ui/error-boundary/ErrorBoundary.test.tsx",
  "src/shared/ui/error-boundary/ErrorBoundary.tsx",
  "src/shared/ui/error-boundary/index.ts",
  "src/shared/ui/form-drawer/FormDrawer.test.tsx",
  "src/shared/ui/form-drawer/FormDrawer.tsx",
  "src/shared/ui/form-drawer/index.ts",
  "src/shared/ui/otp-input/OtpInput.test.tsx",
  "src/shared/ui/otp-input/OtpInput.tsx",
  "src/shared/ui/otp-input/index.ts",
  "src/shared/ui/password-fields/PasswordFields.test.tsx",
  "src/shared/ui/password-fields/PasswordFields.tsx",
  "src/shared/ui/password-fields/index.ts",
  "src/shared/ui/request-feedback/RequestFeedback.test.tsx",
  "src/shared/ui/request-feedback/RequestFeedback.tsx",
  "src/shared/ui/request-feedback/index.ts",
  "src/shared/ui/route-loading/RouteLoading.test.tsx",
  "src/shared/ui/route-loading/RouteLoading.tsx",
  "src/shared/ui/route-loading/index.ts",
  "src/test/render.tsx",
  "src/test/setup.ts",
];
const coreAuthFiles = [
  "docs/admin-request-reliability.fa.md",
  "docs/admin-request-reliability.md",
  "docs/adr/0001-independent-runtimes.fa.md",
  "docs/adr/0001-independent-runtimes.md",
  "docs/adr/0003-single-active-language.fa.md",
  "docs/adr/0003-single-active-language.md",
  "docs/adr/0004-cookie-proxy-and-sessions.fa.md",
  "docs/adr/0004-cookie-proxy-and-sessions.md",
  "docs/adr/README.fa.md",
  "docs/adr/README.md",
  "docs/architecture.fa.md",
  "docs/architecture.md",
  "docs/core-auth.fa.md",
  "docs/core-auth.md",
  "docs/security/authentication-review.fa.md",
  "docs/security/authentication-review.md",
  "src/app/config/index.ts",
  "src/app/config/routes.ts",
  "src/app/contexts/Core.ts",
  "src/app/contexts/index.ts",
  "src/app/hooks/context.test.tsx",
  "src/app/hooks/index.ts",
  "src/app/hooks/useAntd.ts",
  "src/app/hooks/useCore.ts",
  "src/app/lib/access.test.ts",
  "src/app/lib/access.ts",
  "src/app/lib/index.ts",
  "src/app/not-found/NotFound.test.tsx",
  "src/app/not-found/NotFound.tsx",
  "src/app/providers/antd/Antd.test.tsx",
  "src/app/providers/antd/Antd.tsx",
  "src/app/providers/core/Core.test.tsx",
  "src/app/providers/core/Core.tsx",
  "src/app/providers/core/SettingsFeedback.tsx",
  "src/app/providers/index.ts",
  "src/features/auth/useOtpRequest.test.tsx",
  "src/features/auth/useOtpRequest.ts",
  "src/features/forgot-pass/ForgotPass.test.tsx",
  "src/features/forgot-pass/ForgotPass.tsx",
  "src/features/forgot-pass/index.ts",
  "src/features/login/Login.test.tsx",
  "src/features/login/Login.tsx",
  "src/features/login/index.ts",
  "src/features/login/styles.test.ts",
  "src/features/login/styles.ts",
  "src/features/register/Register.test.tsx",
  "src/features/register/Register.tsx",
  "src/features/register/index.ts",
  "src/layouts/auth/Auth.test.tsx",
  "src/layouts/auth/Auth.tsx",
  "src/layouts/auth/index.ts",
  "src/layouts/default/Default.test.tsx",
  "src/layouts/default/Default.tsx",
  "src/layouts/default/index.ts",
];
const businessFiles = [
  "docs/api-client.fa.md",
  "docs/api-client.md",
  "docs/business-screens.fa.md",
  "docs/business-screens.md",
  "docs/input-validation.fa.md",
  "docs/input-validation.md",
  "src/features/account/Account.test.tsx",
  "src/features/account/Account.tsx",
  "src/features/account/index.ts",
  "src/features/calendar/Calendar.test.tsx",
  "src/features/calendar/Calendar.tsx",
  "src/features/calendar/index.ts",
  "src/features/calendar/styles.ts",
  "src/features/dashboard/Dashboard.tsx",
  "src/features/dashboard/index.ts",
  "src/features/roles/Roles.test.tsx",
  "src/features/roles/Roles.tsx",
  "src/features/roles/components/role-form/RoleForm.tsx",
  "src/features/roles/constants.ts",
  "src/features/roles/index.ts",
  "src/features/settings/Settings.test.tsx",
  "src/features/settings/Settings.tsx",
  "src/features/settings/components/logo-upload/LogoUpload.test.tsx",
  "src/features/settings/components/logo-upload/LogoUpload.tsx",
  "src/features/settings/components/logo-upload/index.ts",
  "src/features/settings/index.ts",
  "src/features/users/Users.test.tsx",
  "src/features/users/Users.tsx",
  "src/features/users/components/user-form/UserForm.tsx",
  "src/features/users/components/user-role-form/UserRoleForm.tsx",
  "src/features/users/constants.ts",
  "src/features/users/hooks/useDebouncedFilters.test.tsx",
  "src/features/users/hooks/useDebouncedFilters.ts",
  "src/features/users/hooks/useFilterParams.test.tsx",
  "src/features/users/hooks/useFilterParams.ts",
  "src/features/users/index.ts",
  "src/features/users/tools/password.test.ts",
  "src/features/users/tools/password.ts",
  "src/shared/hooks/useMutationRequest.test.tsx",
  "src/shared/hooks/useMutationRequest.ts",
  "src/test/integration/forms.test.tsx",
  "src/test/storybook/StoryShell.tsx",
  "src/test/storybook/fixtures.ts",
];
const storybookFiles = [
  ".storybook/PreviewFrame.tsx",
  ".storybook/main.ts",
  ".storybook/mocks.ts",
  ".storybook/preview.tsx",
  ".storybook/request-guard.ts",
  ".storybook/request-guard.test.ts",
  ".storybook/vite.config.ts",
  ".storybook/vitest.setup.ts",
  "docs/storybook-verification.fa.md",
  "docs/storybook-verification.md",
  "src/app/not-found/NotFound.stories.tsx",
  "src/features/account/Account.stories.tsx",
  "src/features/calendar/Calendar.stories.tsx",
  "src/features/forgot-pass/ForgotPass.stories.tsx",
  "src/features/login/Login.stories.tsx",
  "src/features/register/Register.stories.tsx",
  "src/features/roles/Roles.stories.tsx",
  "src/features/roles/components/role-form/RoleForm.stories.tsx",
  "src/features/settings/Settings.stories.tsx",
  "src/features/settings/components/logo-upload/LogoUpload.stories.tsx",
  "src/features/users/Users.stories.tsx",
  "src/features/users/components/user-form/UserForm.stories.tsx",
  "src/features/users/components/user-role-form/UserRoleForm.stories.tsx",
  "src/layouts/auth/Auth.stories.tsx",
  "src/layouts/default/Default.stories.tsx",
  "src/shared/ui/digits-input/DigitsInput.stories.tsx",
  "src/shared/ui/error-boundary/ErrorBoundary.stories.tsx",
  "src/shared/ui/form-drawer/FormDrawer.stories.tsx",
  "src/shared/ui/icon/Icon.stories.tsx",
  "src/shared/ui/otp-input/OtpInput.stories.tsx",
  "src/shared/ui/password-fields/PasswordFields.stories.tsx",
  "src/shared/ui/route-loading/RouteLoading.stories.tsx",
  "src/test/storybook/StoryAppearance.ts",
  "src/test/storybook/StoryAppearance.stories.tsx",
  "src/test/storybook/StoryShell.test.tsx",
  "src/test/storybook/Transport.stories.tsx",
  "vitest.storybook.config.ts",
];
const phaseOrder = [
  "governance",
  "foundation",
  "catalogs",
  "runtime-localization",
  "http-lifecycle",
  "ui-foundation",
  "core-auth",
  "business-screens",
  "storybook-verification",
];
const supportsPhase = (phase, minimum) =>
  phaseOrder.indexOf(phase) >= phaseOrder.indexOf(minimum);
const publishedSource = (file, phase) =>
  phase !== "governance" &&
  (isFoundationSource(file) ||
    (supportsPhase(phase, "catalogs") && catalogFiles.includes(file)) ||
    (supportsPhase(phase, "runtime-localization") &&
      runtimeFiles.includes(file)) ||
    (supportsPhase(phase, "http-lifecycle") && httpFiles.includes(file)) ||
    (supportsPhase(phase, "ui-foundation") && uiFiles.includes(file)) ||
    (supportsPhase(phase, "core-auth") && coreAuthFiles.includes(file)) ||
    (supportsPhase(phase, "business-screens") &&
      businessFiles.includes(file)) ||
    (phase === "storybook-verification" && storybookFiles.includes(file)));

export const validateBootstrapPolicy = (policy) => {
  if (
    policy?.schemaVersion !== 1 ||
    !phaseOrder.includes(policy.phase) ||
    policy.applicationReady !== false ||
    policy.maximumChangedFiles !== 100 ||
    !Array.isArray(policy.allowedFiles) ||
    !policy.allowedFiles.length
  )
    throw new Error("An explicit non-runnable publication phase is required.");
  const files = new Set();
  for (const file of policy.allowedFiles) {
    if (
      typeof file !== "string" ||
      !file ||
      file.includes("\\") ||
      file.split("/").some((part) => !part || part === "." || part === "..") ||
      /[*?[\]{}:\r\n]/.test(file) ||
      /^(?:apps|packages|drizzle|collection|deploy|node_modules|server|coverage)(?:\/|$)/.test(
        file,
      ) ||
      file === "drizzle.config.ts" ||
      file === "index.html" ||
      file === "vite.config.ts" ||
      ((file.startsWith(".storybook/") ||
        file === "vitest.storybook.config.ts") &&
        (policy.phase !== "storybook-verification" ||
          !storybookFiles.includes(file))) ||
      (file.startsWith("src/") && !publishedSource(file, policy.phase)) ||
      (policy.phase === "governance" &&
        /^package(?:-lock)?\.json$/.test(file)) ||
      /(?:^|\/)(?:\.env(?:\.|$)|settings\.local\.json$)/.test(file) ||
      /\.(?:pem|key|pfx|p12|sqlite|db)$/.test(file) ||
      files.has(file)
    )
      throw new Error(
        "Publication files must be unique, exact paths within their declared phase.",
      );
    files.add(file);
  }
  const requiredFiles = [
    ...coreFiles,
    ...(policy.phase === "governance"
      ? [".github/workflows/bootstrap.yml"]
      : foundationFiles),
    ...(supportsPhase(policy.phase, "catalogs") ? catalogFiles : []),
    ...(supportsPhase(policy.phase, "runtime-localization")
      ? runtimeFiles
      : []),
    ...(supportsPhase(policy.phase, "http-lifecycle") ? httpFiles : []),
    ...(supportsPhase(policy.phase, "ui-foundation") ? uiFiles : []),
    ...(supportsPhase(policy.phase, "core-auth") ? coreAuthFiles : []),
    ...(supportsPhase(policy.phase, "business-screens") ? businessFiles : []),
    ...(policy.phase === "storybook-verification" ? storybookFiles : []),
  ];
  if (requiredFiles.some((file) => !files.has(file)))
    throw new Error(
      "The bootstrap policy cannot omit its mandatory guard files.",
    );
  return files;
};

export const inspectBootstrap = async (root) => {
  if (
    (await lstat(path.join(root, ".github"))).isSymbolicLink() ||
    (await lstat(path.join(root, policyPath))).isSymbolicLink()
  )
    throw new Error("Bootstrap snapshots must not contain symbolic links.");
  const policy = JSON.parse(
    await readFile(path.join(root, policyPath), "utf8"),
  );
  const allowed = validateBootstrapPolicy(policy);
  const directories = new Set(
    [...allowed].flatMap((file) => {
      const parts = file.split("/");
      return parts
        .slice(0, -1)
        .map((_, index) => parts.slice(0, index + 1).join("/"));
    }),
  );
  const found = new Set();
  const visit = async (directory) => {
    const entries = await readdir(path.join(root, directory), {
      withFileTypes: true,
    });
    await Promise.all(
      entries.map(async (entry) => {
        const relative = directory ? `${directory}/${entry.name}` : entry.name;
        if (relative === ".git") return;
        if (
          policy.phase !== "governance" &&
          ["node_modules", "coverage"].includes(relative)
        ) {
          if (entry.isSymbolicLink() || !entry.isDirectory())
            throw new Error(
              "Generated output must be an ordinary root directory.",
            );
          return;
        }
        if (entry.isSymbolicLink())
          throw new Error(
            "Bootstrap snapshots must not contain symbolic links.",
          );
        if (entry.isDirectory() && directories.has(relative)) {
          await visit(relative);
        } else if (entry.isFile() && allowed.has(relative)) {
          found.add(relative);
        } else {
          throw new Error(`Unexpected bootstrap path: ${relative}`);
        }
      }),
    );
  };
  await visit("");
  if ([...allowed].some((file) => !found.has(file)))
    throw new Error(
      "The published bootstrap snapshot is missing declared files.",
    );

  await Promise.all(
    [...found].map(async (file) => {
      if (file.endsWith(".json"))
        JSON.parse(await readFile(path.join(root, file), "utf8"));
      if (file.endsWith(".mjs")) {
        const result = spawnSync(
          process.execPath,
          ["--check", path.join(root, file)],
          {
            cwd: root,
            encoding: "utf8",
            windowsHide: true,
          },
        );
        if (result.error || result.status !== 0)
          throw new Error(`Bootstrap JavaScript syntax is invalid: ${file}`);
      }
    }),
  );
  const scopeByPhase = {
    "storybook-verification":
      "Published isolated Storybook build and real Chromium component interactions/accessibility with synthetic API fixtures; no application entry point, assembled routes, production application build, external API journey or visual gate is published.",
    "business-screens":
      "Published business screen/form modules with guarded mutations and synthetic HTTP/React tests; no application entry point, assembled routes, production build, Storybook/browser journey or visual gate is published.",
    "core-auth":
      "Published Core and Ant Design providers, typed access/navigation metadata, authentication forms and layouts with synthetic lifecycle tests; no application entry point, route composition, production build, browser journey or visual gate is published.",
    "ui-foundation":
      "Published Ant Design widgets, theme/preferences/observability foundations, real font/vector asset validation and synthetic HTTP/React tests; application composition, production build, browser journeys and visual validation remain unpublished.",
    "http-lifecycle":
      "Published admin HTTP transport, feature wire adapters, complete server-owned settings metadata and request lifecycle hooks, with synthetic HTTP and real hook tests; the runnable panel, production build and browser journeys are not published or validated.",
    "runtime-localization":
      "Published admin primitives, complete catalogs and real translation/date runtime adapters; UI, API integration and browser journeys are not published or validated.",
    governance:
      "Published governance files only; the admin application is not published or validated.",
    foundation:
      "Published admin token state, transport types and pure utilities only; UI, API integration and browser behavior are not published or validated.",
    catalogs:
      "Published admin primitives and complete local catalog data; runtime translation adapters, UI, API integration and browser behavior are not published or validated.",
  };
  return {
    applicationReady: false,
    files: found.size,
    phase: policy.phase,
    scope: scopeByPhase[policy.phase],
  };
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await inspectBootstrap(process.cwd());
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Bootstrap validation failed.",
    );
    process.exitCode = 1;
  }
}
