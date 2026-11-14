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
  "scripts/validate-bootstrap.mjs",
  "scripts/validate-bootstrap.test.mjs",
];
const policy = (overrides = {}) => ({
  allowedFiles: coreFiles,
  applicationReady: false,
  phase: "governance",
  schemaVersion: 1,
  ...overrides,
});
const completeApplicationFiles = [
  "src/shared/storage/hooks/index.ts",
  "src/shared/ui/error-boundary/ErrorFallback.tsx",
  ".agents/README.md",
  ".agents/evaluation/cases.json",
  ".agents/evaluation/run-template.json",
  ".agents/hooks/block-dangerous.mjs",
  ".agents/hooks/block-dangerous.sh",
  ".agents/hooks/post-edit-format.sh",
  ".agents/hooks/quality-gate.sh",
  ".agents/navigation.json",
  ".agents/rules/admin.md",
  ".agents/rules/api-collection.md",
  ".agents/rules/branches.md",
  ".agents/rules/code-quality.md",
  ".agents/rules/code-review.md",
  ".agents/rules/collection-quality.md",
  ".agents/rules/commits.md",
  ".agents/rules/git.md",
  ".agents/rules/guidance.md",
  ".agents/rules/imports.md",
  ".agents/rules/issues.md",
  ".agents/rules/localization.md",
  ".agents/rules/ordering.md",
  ".agents/rules/pull-requests.md",
  ".agents/rules/react.md",
  ".agents/rules/safety.md",
  ".agents/rules/styling.md",
  ".agents/rules/testing.md",
  ".agents/rules/typescript.md",
  ".agents/settings.json",
  ".agents/skills/commit/SKILL.md",
  ".agents/skills/create-issue/SKILL.md",
  ".agents/skills/create-pr/SKILL.md",
  ".agents/skills/design-ui/SKILL.md",
  ".agents/skills/review-pr/SKILL.md",
  ".agents/skills/start-issue/SKILL.md",
  ".agents/skills/validate-change/SKILL.md",
  ".agents/validation.json",
  ".claude/skills/design-ui/SKILL.md",
  ".coderabbit.yaml",
  ".dockerignore",
  ".env.example",
  ".gitattributes",
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/bootstrap-policy.json",
  ".github/dependabot.yml",
  ".github/workflows/ci.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/dast.yml",
  ".github/workflows/deployment-smoke.yml",
  ".github/workflows/mutation.yml",
  ".github/workflows/release.yml",
  ".github/workflows/staging.yml",
  ".gitignore",
  ".nvmrc",
  ".prettierignore",
  ".prettierrc.json",
  ".release-please-manifest.json",
  ".storybook/PreviewFrame.tsx",
  ".storybook/main.ts",
  ".storybook/mocks.ts",
  ".storybook/preview.tsx",
  ".storybook/request-guard.test.ts",
  ".storybook/request-guard.ts",
  ".storybook/vite.config.ts",
  ".storybook/vitest.setup.ts",
  "AGENTS.md",
  "CHANGELOG.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "DESIGN.md",
  "README.md",
  "SECURITY.md",
  "contract/api.contract.test.ts",
  "deploy/docker/Dockerfile",
  "deploy/docker/README.md",
  "deploy/docker/admin-entrypoint.sh",
  "deploy/docker/admin-healthcheck.sh",
  "deploy/docker/compose.env.example",
  "deploy/docker/compose.yaml",
  "deploy/native/README.md",
  "deploy/native/nginx.env.example",
  "deploy/native/nginx/acme-bootstrap.conf.template",
  "deploy/native/nginx/admin.conf.template",
  "docs/README.md",
  "docs/architecture.md",
  "docs/authentication.md",
  "docs/comprehension-evaluation.md",
  "docs/deployment.md",
  "docs/development.md",
  "docs/localization.md",
  "docs/testing.md",
  "docs/usage.md",
  "docs/validation.md",
  "e2e/accessibility.spec.ts",
  "e2e/auth.spec.ts",
  "e2e/fixtures.ts",
  "e2e/font.spec.ts",
  "e2e/language-authority.spec.ts",
  "e2e/localization.spec.ts",
  "e2e/management.spec.ts",
  "e2e/request-reliability.spec.ts",
  "e2e/security-headers.spec.ts",
  "e2e/shared/admin-fixtures.ts",
  "e2e/visual/admin.spec.ts",
  "e2e/visual/baselines/application/win32/admin-forgot-password-en-light.png",
  "e2e/visual/baselines/application/win32/admin-login-en-light.png",
  "e2e/visual/baselines/application/win32/admin-login-fa-dark.png",
  "e2e/visual/baselines/application/win32/admin-register-en-light.png",
  "e2e/visual/baselines/application/win32/admin-role-drawer-en-dark.png",
  "e2e/visual/baselines/application/win32/admin-users-fa-light.png",
  "e2e/visual/baselines/application/win32/metadata.json",
  "e2e/visual/baselines/win32/admin-login-en-light.png",
  "e2e/visual/baselines/win32/admin-login-fa-dark.png",
  "e2e/visual/baselines/win32/admin-role-drawer-en-dark.png",
  "e2e/visual/baselines/win32/admin-users-fa-light.png",
  "e2e/visual/baselines/win32/metadata.json",
  "e2e/visual/readiness.ts",
  "eslint.config.mjs",
  "index.html",
  "knip.json",
  "package-lock.json",
  "package.json",
  "playwright.config.ts",
  "playwright.visual.config.ts",
  "public/favicon.svg",
  "public/logo.svg",
  "release-please-config.json",
  "scripts/block-dangerous.test.mjs",
  "scripts/check-boundaries.mjs",
  "scripts/check-boundaries.test.mjs",
  "scripts/check-bundle-size.mjs",
  "scripts/check-bundle-size.test.mjs",
  "scripts/check-ci.mjs",
  "scripts/check-ci.test.mjs",
  "scripts/check-guidance.integration.test.mjs",
  "scripts/check-guidance.mjs",
  "scripts/check-guidance.test-support.mjs",
  "scripts/check-guidance.test.mjs",
  "scripts/dependency-compatibility.test.mjs",
  "scripts/deploy-runtime.test.mjs",
  "scripts/deployment.integration.test.mjs",
  "scripts/deployment.test-support.mjs",
  "scripts/docker-smoke-resources.mjs",
  "scripts/docker-smoke-resources.test-support.mjs",
  "scripts/docker-smoke-resources.test.mjs",
  "scripts/healthcheck.mjs",
  "scripts/healthcheck.test.mjs",
  "scripts/hooks.test-support.mjs",
  "scripts/lighthouse-policy.mjs",
  "scripts/lighthouse-policy.test-support.mjs",
  "scripts/lighthouse-policy.test.mjs",
  "scripts/package-release.mjs",
  "scripts/package-release.test.mjs",
  "scripts/post-edit-format.test.mjs",
  "scripts/quality-gate.test.mjs",
  "scripts/render-deployment.integration.test.mjs",
  "scripts/render-deployment.mjs",
  "scripts/render-deployment.test.mjs",
  "scripts/run-audit.mjs",
  "scripts/run-audit.test.mjs",
  "scripts/run-lighthouse.mjs",
  "scripts/run-lighthouse.test.mjs",
  "scripts/run-visual.integration.test.mjs",
  "scripts/run-visual.mjs",
  "scripts/run-visual.test.mjs",
  "scripts/stamp-admin-build.mjs",
  "scripts/stamp-admin-build.test.mjs",
  "scripts/stop-visual-process-tree.ps1",
  "scripts/stop-visual-process-tree.test.ps1",
  "scripts/test-docker-release.mjs",
  "scripts/test-docker-release.test.mjs",
  "scripts/validate-bootstrap.mjs",
  "scripts/validate-bootstrap.test.mjs",
  "scripts/validate-deployment-env.mjs",
  "scripts/validate-deployment-env.test.mjs",
  "scripts/validate-production-env.mjs",
  "scripts/validate-production-env.test.mjs",
  "scripts/validate-workflow-targets.mjs",
  "scripts/validate-workflow-targets.test.mjs",
  "scripts/validate.mjs",
  "scripts/validate.test.mjs",
  "scripts/visual-environment.mjs",
  "scripts/visual-environment.test.mjs",
  "smoke.config.ts",
  "smoke/deployment.spec.ts",
  "smoke/setup.ts",
  "sonar-project.properties",
  "src/app/App.tsx",
  "src/app/Routes.test.tsx",
  "src/app/Routes.tsx",
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
  "src/app/not-found/NotFound.stories.tsx",
  "src/app/not-found/NotFound.test.tsx",
  "src/app/not-found/NotFound.tsx",
  "src/app/providers/antd/Antd.test.tsx",
  "src/app/providers/antd/Antd.tsx",
  "src/app/providers/core/Core.test.tsx",
  "src/app/providers/core/Core.tsx",
  "src/app/providers/index.ts",
  "src/assets/assets.test.ts",
  "src/assets/fonts/vazirmatn/OFL.txt",
  "src/assets/fonts/vazirmatn/Vazirmatn-Variable.woff2",
  "src/assets/styles/index.css",
  "src/assets/styles/vazirmatn.css",
  "src/features/account/Account.stories.tsx",
  "src/features/account/Account.test.tsx",
  "src/features/account/Account.tsx",
  "src/features/account/api.test.ts",
  "src/features/account/api.ts",
  "src/features/account/index.ts",
  "src/features/account/types.ts",
  "src/features/auth/api.test.ts",
  "src/features/auth/api.ts",
  "src/features/auth/index.ts",
  "src/features/auth/logout.test.ts",
  "src/features/auth/types.ts",
  "src/features/auth/useOtpRequest.test.tsx",
  "src/features/auth/useOtpRequest.ts",
  "src/features/calendar/Calendar.stories.tsx",
  "src/features/calendar/Calendar.test.tsx",
  "src/features/calendar/Calendar.tsx",
  "src/features/calendar/api.test.ts",
  "src/features/calendar/api.ts",
  "src/features/calendar/index.ts",
  "src/features/calendar/styles.ts",
  "src/features/dashboard/Dashboard.tsx",
  "src/features/dashboard/index.ts",
  "src/features/forgot-pass/ForgotPass.stories.tsx",
  "src/features/forgot-pass/ForgotPass.test.tsx",
  "src/features/forgot-pass/ForgotPass.tsx",
  "src/features/forgot-pass/index.ts",
  "src/features/login/Login.stories.tsx",
  "src/features/login/Login.test.tsx",
  "src/features/login/Login.tsx",
  "src/features/login/index.ts",
  "src/features/register/Register.stories.tsx",
  "src/features/register/Register.test.tsx",
  "src/features/register/Register.tsx",
  "src/features/register/index.ts",
  "src/features/roles/Roles.stories.tsx",
  "src/features/roles/Roles.test.tsx",
  "src/features/roles/Roles.tsx",
  "src/features/roles/api.test.ts",
  "src/features/roles/api.ts",
  "src/features/roles/components/role-form/RoleForm.stories.tsx",
  "src/features/roles/components/role-form/RoleForm.tsx",
  "src/features/roles/index.ts",
  "src/features/roles/types.ts",
  "src/features/settings/Settings.stories.tsx",
  "src/features/settings/Settings.test.tsx",
  "src/features/settings/Settings.tsx",
  "src/features/settings/api.test.ts",
  "src/features/settings/api.ts",
  "src/features/settings/index.ts",
  "src/features/settings/types.ts",
  "src/features/users/Users.stories.tsx",
  "src/features/users/Users.test.tsx",
  "src/features/users/Users.tsx",
  "src/features/users/api.helpers.test.ts",
  "src/features/users/api.test.ts",
  "src/features/users/api.ts",
  "src/features/users/components/user-form/UserForm.stories.tsx",
  "src/features/users/components/user-form/UserForm.tsx",
  "src/features/users/components/user-role-form/UserRoleForm.stories.tsx",
  "src/features/users/components/user-role-form/UserRoleForm.tsx",
  "src/features/users/constants.ts",
  "src/features/users/index.ts",
  "src/features/users/types.ts",
  "src/layouts/auth/Auth.stories.tsx",
  "src/layouts/auth/Auth.test.tsx",
  "src/layouts/auth/Auth.tsx",
  "src/layouts/auth/index.ts",
  "src/layouts/default/Default.stories.tsx",
  "src/layouts/default/Default.test.tsx",
  "src/layouts/default/Default.tsx",
  "src/layouts/default/index.ts",
  "src/main.tsx",
  "src/shared/api/client.test.ts",
  "src/shared/api/client.ts",
  "src/shared/api/config.test.ts",
  "src/shared/api/config.ts",
  "src/shared/api/index.ts",
  "src/shared/api/path.test.ts",
  "src/shared/api/path.ts",
  "src/shared/api/token.test.ts",
  "src/shared/api/token.ts",
  "src/shared/api/transport.test.ts",
  "src/shared/api/types.ts",
  "src/shared/config/constants.ts",
  "src/shared/config/index.ts",
  "src/shared/config/language.test.ts",
  "src/shared/config/language.ts",
  "src/shared/config/theme.test.ts",
  "src/shared/config/theme.ts",
  "src/shared/contracts/appearance.test.ts",
  "src/shared/contracts/appearance.ts",
  "src/shared/contracts/index.ts",
  "src/shared/hooks/index.ts",
  "src/shared/hooks/useGoBack.test.tsx",
  "src/shared/hooks/useGoBack.ts",
  "src/shared/hooks/useMutationRequest.test.tsx",
  "src/shared/hooks/useMutationRequest.ts",
  "src/shared/hooks/useReadRequest.ts",
  "src/shared/hooks/useReadResource.test.ts",
  "src/shared/hooks/useReadResource.ts",
  "src/shared/i18n/catalogs.test.ts",
  "src/shared/i18n/catalogs.ts",
  "src/shared/i18n/date.test.ts",
  "src/shared/i18n/date.ts",
  "src/shared/i18n/dayjs.test.ts",
  "src/shared/i18n/dayjs/fa.ts",
  "src/shared/i18n/index.test.ts",
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
  "src/shared/lib/color-contrast.test.ts",
  "src/shared/lib/color-contrast.ts",
  "src/shared/lib/error.test.ts",
  "src/shared/lib/error.ts",
  "src/shared/lib/index.ts",
  "src/shared/lib/observability.test.ts",
  "src/shared/lib/observability.ts",
  "src/shared/lib/observability.vitals.test.ts",
  "src/shared/lib/transform.test.ts",
  "src/shared/lib/transform.ts",
  "src/shared/storage/compact.ts",
  "src/shared/storage/hooks/useLocalStorageWatcher.test.ts",
  "src/shared/storage/hooks/useLocalStorageWatcher.ts",
  "src/shared/storage/index.ts",
  "src/shared/storage/preferences.test.ts",
  "src/shared/storage/state.test.ts",
  "src/shared/storage/state.ts",
  "src/shared/storage/theme.ts",
  "src/shared/ui/digits-input/DigitsInput.stories.tsx",
  "src/shared/ui/digits-input/DigitsInput.test.tsx",
  "src/shared/ui/digits-input/DigitsInput.tsx",
  "src/shared/ui/digits-input/index.ts",
  "src/shared/ui/error-boundary/ErrorBoundary.stories.tsx",
  "src/shared/ui/error-boundary/ErrorBoundary.test.tsx",
  "src/shared/ui/error-boundary/ErrorBoundary.tsx",
  "src/shared/ui/error-boundary/index.ts",
  "src/shared/ui/form-drawer/FormDrawer.stories.tsx",
  "src/shared/ui/form-drawer/FormDrawer.test.tsx",
  "src/shared/ui/form-drawer/FormDrawer.tsx",
  "src/shared/ui/form-drawer/index.ts",
  "src/shared/ui/icon/Icon.stories.tsx",
  "src/shared/ui/otp-input/OtpInput.stories.tsx",
  "src/shared/ui/otp-input/OtpInput.test.tsx",
  "src/shared/ui/otp-input/OtpInput.tsx",
  "src/shared/ui/otp-input/index.ts",
  "src/shared/ui/password-fields/PasswordFields.stories.tsx",
  "src/shared/ui/password-fields/PasswordFields.test.tsx",
  "src/shared/ui/password-fields/PasswordFields.tsx",
  "src/shared/ui/password-fields/index.ts",
  "src/shared/ui/request-feedback/RequestFeedback.test.tsx",
  "src/shared/ui/request-feedback/RequestFeedback.tsx",
  "src/shared/ui/request-feedback/index.ts",
  "src/shared/ui/route-loading/RouteLoading.stories.tsx",
  "src/shared/ui/route-loading/RouteLoading.test.tsx",
  "src/shared/ui/route-loading/RouteLoading.tsx",
  "src/shared/ui/route-loading/index.ts",
  "src/test/http-setup.ts",
  "src/test/integration/forms.test.tsx",
  "src/test/integration/pages.test.tsx",
  "src/test/mocks/handlers.ts",
  "src/test/mocks/server.ts",
  "src/test/render.tsx",
  "src/test/setup.ts",
  "src/test/storybook/StoryAppearance.stories.tsx",
  "src/test/storybook/StoryAppearance.ts",
  "src/test/storybook/StoryShell.test.tsx",
  "src/test/storybook/StoryShell.tsx",
  "src/test/storybook/Transport.stories.tsx",
  "src/test/storybook/fixtures.ts",
  "src/vite-env.d.ts",
  "staging.config.ts",
  "staging/setup.ts",
  "staging/staging.spec.ts",
  "stryker.config.json",
  "tooling/paths.ts",
  "tsconfig.app.json",
  "tsconfig.json",
  "tsconfig.node.json",
  "vite.config.ts",
  "vitest.config.ts",
  "vitest.contract.config.ts",
  "vitest.shims.d.ts",
  "vitest.storybook.config.ts",
  "src/GlobalStyle.tsx",
  "src/app/providers/antd/index.ts",
  "src/app/providers/core/index.ts",
  "src/features/files/Files.tsx",
  "src/features/files/api.test.ts",
  "src/features/files/api.ts",
  "src/features/files/index.ts",
  "src/features/files/types.ts",
  "src/layouts/default/types.ts",
  "src/shared/api/refresh.test.ts",
  "src/shared/api/refresh.ts",
  "src/shared/hooks/useAbortController.test.tsx",
  "src/shared/hooks/useAbortController.ts",
  "src/shared/hooks/useLock.test.tsx",
  "src/shared/hooks/useLock.ts",
  "src/shared/ui/image-upload/ImageUpload.test.tsx",
  "src/shared/ui/image-upload/ImageUpload.tsx",
  "src/shared/ui/image-upload/image.test.ts",
  "src/shared/ui/image-upload/image.ts",
  "src/shared/ui/image-upload/index.ts",
  "src/test/deferred.ts",
  "src/features/roles/components/role-form/RoleForm.test.tsx",
  "src/features/users/components/user-form/UserForm.test.tsx",
  "src/features/users/components/user-form/index.ts",
  "src/features/users/components/user-role-form/UserRoleForm.test.tsx",
  "src/features/users/components/user-role-form/index.ts",
  "src/shared/hooks/useDebouncedFilters.test.tsx",
  "src/shared/hooks/useDebouncedFilters.ts",
  "src/shared/hooks/useFilterParams.test.tsx",
  "src/shared/hooks/useFilterParams.ts",
  "src/shared/lib/allowed-value.ts",
  "src/shared/lib/pagination.ts",
  "src/shared/lib/password.test.ts",
  "src/shared/lib/password.ts",
];
const applicationPolicy = () =>
  policy({
    phase: "application-verification",
    applicationReady: true,
    allowedFiles: [...completeApplicationFiles],
  });
const applicationFiles = [
  ".github/workflows/codeql.yml",
  ".github/workflows/dast.yml",
  ".github/workflows/release.yml",
  ".github/workflows/mutation.yml",
  ".github/workflows/staging.yml",
  ".github/workflows/deployment-smoke.yml",
  "stryker.config.json",
  "staging.config.ts",
  "staging/setup.ts",
  "staging/staging.spec.ts",
  "smoke.config.ts",
  "smoke/setup.ts",
  "smoke/deployment.spec.ts",
  "CHANGELOG.md",
  "scripts/stop-visual-process-tree.ps1",
  "scripts/stop-visual-process-tree.test.ps1",
  "contract/api.contract.test.ts",
  "e2e/accessibility.spec.ts",
  "e2e/auth.spec.ts",
  "e2e/fixtures.ts",
  "e2e/font.spec.ts",
  "e2e/language-authority.spec.ts",
  "e2e/localization.spec.ts",
  "e2e/management.spec.ts",
  "e2e/request-reliability.spec.ts",
  "e2e/security-headers.spec.ts",
  "e2e/shared/admin-fixtures.ts",
  "e2e/visual/admin.spec.ts",
  "e2e/visual/readiness.ts",
  "index.html",
  "knip.json",
  "playwright.config.ts",
  "playwright.visual.config.ts",
  "src/app/App.tsx",
  "src/app/Routes.test.tsx",
  "src/app/Routes.tsx",
  "src/main.tsx",
  "src/test/integration/pages.test.tsx",
  "tsconfig.node.json",
  "vite.config.ts",
  "vitest.contract.config.ts",
  "vitest.shims.d.ts",
  "e2e/visual/baselines/application/win32/admin-login-en-light.png",
  "e2e/visual/baselines/application/win32/admin-login-fa-dark.png",
  "e2e/visual/baselines/application/win32/admin-role-drawer-en-dark.png",
  "e2e/visual/baselines/application/win32/admin-users-fa-light.png",
  "e2e/visual/baselines/application/win32/admin-forgot-password-en-light.png",
  "e2e/visual/baselines/application/win32/admin-register-en-light.png",
  "e2e/visual/baselines/application/win32/metadata.json",
  "src/GlobalStyle.tsx",
  "src/app/providers/antd/index.ts",
  "src/app/providers/core/index.ts",
  "src/features/files/Files.tsx",
  "src/features/files/api.test.ts",
  "src/features/files/api.ts",
  "src/features/files/index.ts",
  "src/features/files/types.ts",
  "src/layouts/default/types.ts",
  "src/shared/api/refresh.test.ts",
  "src/shared/api/refresh.ts",
  "src/shared/hooks/useAbortController.test.tsx",
  "src/shared/hooks/useAbortController.ts",
  "src/shared/hooks/useLock.test.tsx",
  "src/shared/hooks/useLock.ts",
  "src/shared/ui/image-upload/ImageUpload.test.tsx",
  "src/shared/ui/image-upload/ImageUpload.tsx",
  "src/shared/ui/image-upload/image.test.ts",
  "src/shared/ui/image-upload/image.ts",
  "src/shared/ui/image-upload/index.ts",
  "src/test/deferred.ts",
  "src/features/roles/components/role-form/RoleForm.test.tsx",
  "src/features/users/components/user-form/UserForm.test.tsx",
  "src/features/users/components/user-form/index.ts",
  "src/features/users/components/user-role-form/UserRoleForm.test.tsx",
  "src/features/users/components/user-role-form/index.ts",
  "src/shared/hooks/useDebouncedFilters.test.tsx",
  "src/shared/hooks/useDebouncedFilters.ts",
  "src/shared/hooks/useFilterParams.test.tsx",
  "src/shared/hooks/useFilterParams.ts",
  "src/shared/lib/allowed-value.ts",
  "src/shared/lib/pagination.ts",
  "src/shared/lib/password.test.ts",
  "src/shared/lib/password.ts",
];
const isCoreAuthPhaseFile = (file) =>
  /^(?:src\/(?:app|layouts|features\/(?:forgot-pass|login|register))\/|docs\/architecture\.md$)/.test(
    file,
  ) ||
  [
    "SECURITY.md",
    "src/features/auth/index.ts",
    "src/features/auth/useOtpRequest.ts",
    "src/features/auth/useOtpRequest.test.tsx",
  ].includes(file);

const isBusinessPhaseFile = (file) =>
  /^scripts\/(?:(?:healthcheck|validate-deployment-env)(?:\.test)?|deployment\.test-support)\.mjs$/.test(
    file,
  ) ||
  (/^src\/features\/(?:account|calendar|dashboard|roles|settings|users)\//.test(
    file,
  )
    ? !/\/(?:api(?:\.helpers)?(?:\.test)?|types)\.tsx?$/.test(file)
    : /^src\/test\/(?:storybook\/|integration\/forms\.test)/.test(file));

const isStorybookPhaseFile = (file) =>
  file.startsWith(".storybook/") ||
  file.endsWith(".stories.tsx") ||
  file === "vitest.storybook.config.ts" ||
  /^(?:docs\/testing\.md|src\/test\/storybook\/StoryShell\.test\.tsx)$/.test(
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
    "CONTRIBUTING.md",
  ].includes(file) ||
  /^docs\/(?:README|comprehension-evaluation|validation)\.md$/.test(file) ||
  /^scripts\/(?:(?:block-dangerous|post-edit-format|quality-gate)\.test|hooks\.test-support|check-guidance(?:\.test)?)\.mjs$/.test(
    file,
  );

const operationsPrerequisiteFiles = [
  "deploy/docker/admin-entrypoint.sh",
  "deploy/docker/admin-healthcheck.sh",
  "scripts/check-guidance.integration.test.mjs",
  "scripts/dependency-compatibility.test.mjs",
  "scripts/deploy-runtime.test.mjs",
  "scripts/deployment.integration.test.mjs",
  "scripts/healthcheck.test.mjs",
  "scripts/render-deployment.integration.test.mjs",
  "scripts/render-deployment.test.mjs",
  "scripts/run-visual.integration.test.mjs",
  "scripts/run-visual.test.mjs",
  "scripts/validate-deployment-env.test.mjs",
  "scripts/visual-environment.test.mjs",
  "scripts/check-guidance.test-support.mjs",
  "scripts/deployment.test-support.mjs",
  ".dockerignore",
  ".env.example",
  ".release-please-manifest.json",
  "SECURITY.md",
  "deploy/docker/compose.env.example",
  "deploy/docker/Dockerfile",
  "deploy/docker/README.md",
  "deploy/docker/compose.yaml",
  "scripts/docker-smoke-resources.mjs",
  "scripts/test-docker-release.mjs",
  "deploy/native/README.md",
  "deploy/native/nginx.env.example",
  "deploy/native/nginx/admin.conf.template",
  "deploy/native/nginx/acme-bootstrap.conf.template",
  "docs/testing.md",
  "docs/deployment.md",
  "docs/development.md",
  "e2e/visual/baselines/win32/admin-login-en-light.png",
  "e2e/visual/baselines/win32/admin-login-fa-dark.png",
  "e2e/visual/baselines/win32/admin-role-drawer-en-dark.png",
  "e2e/visual/baselines/win32/admin-users-fa-light.png",
  "e2e/visual/baselines/win32/metadata.json",
  "release-please-config.json",
  "scripts/check-bundle-size.mjs",
  "scripts/check-bundle-size.test.mjs",
  "scripts/docker-smoke-resources.test.mjs",
  "scripts/docker-smoke-resources.test-support.mjs",
  "scripts/test-docker-release.test.mjs",
  "scripts/healthcheck.mjs",
  "scripts/lighthouse-policy.mjs",
  "scripts/lighthouse-policy.test.mjs",
  "scripts/lighthouse-policy.test-support.mjs",
  "scripts/package-release.mjs",
  "scripts/package-release.test.mjs",
  "scripts/render-deployment.mjs",
  "scripts/run-lighthouse.mjs",
  "scripts/run-lighthouse.test.mjs",
  "scripts/run-visual.mjs",
  "scripts/stamp-admin-build.mjs",
  "scripts/stamp-admin-build.test.mjs",
  "scripts/validate-deployment-env.mjs",
  "scripts/validate-production-env.mjs",
  "scripts/validate-production-env.test.mjs",
  "scripts/validate-workflow-targets.mjs",
  "scripts/validate-workflow-targets.test.mjs",
  "scripts/visual-environment.mjs",
  "tooling/paths.ts",
];
const deferredApplicationPrerequisites = [
  "scripts/run-lighthouse.mjs",
  "scripts/run-lighthouse.test.mjs",
  "scripts/run-visual.mjs",
  "scripts/run-visual.test.mjs",
  "scripts/run-visual.integration.test.mjs",
  "scripts/visual-environment.mjs",
  "scripts/visual-environment.test.mjs",
  "scripts/validate-production-env.mjs",
  "scripts/validate-production-env.test.mjs",
  "scripts/validate-workflow-targets.mjs",
  "scripts/validate-workflow-targets.test.mjs",
];

const retiredApplicationCompanions = [
  "CONTRIBUTING.fa.md",
  "DESIGN.fa.md",
  "README.fa.md",
  "docs/README.fa.md",
  "docs/accessibility.fa.md",
  "docs/admin-request-reliability.fa.md",
  "docs/ai-code-understanding.fa.md",
  "docs/api-client.fa.md",
  "docs/architecture.fa.md",
  "docs/bootstrap.fa.md",
  "docs/business-screens.fa.md",
  "docs/change-workflow.fa.md",
  "docs/component-coverage.fa.md",
  "docs/comprehension-evaluation.fa.md",
  "docs/contract-testing.fa.md",
  "docs/core-auth.fa.md",
  "docs/feature-development.fa.md",
  "docs/http-client.fa.md",
  "docs/input-validation.fa.md",
  "docs/localization.fa.md",
  "docs/quality-attributes.fa.md",
  "docs/request-lifecycle.fa.md",
  "docs/source-navigation.fa.md",
  "docs/storybook-verification.fa.md",
  "docs/testing.fa.md",
  "docs/ui-foundation.fa.md",
  "docs/validation.fa.md",
];
const historicalPublicationFiles = (latest) => [
  ...new Set([
    ...latest.allowedFiles,
    ...retiredApplicationCompanions,
    ".github/workflows/sonar.yml",
  ]),
];
const earlierPhaseDocuments = new Set([
  "docs/authentication.md",
  "docs/development.md",
  "docs/testing.md",
  "SECURITY.md",
]);
const earlierOperationsSources = new Set([
  "scripts/deployment.test-support.mjs",
  "tooling/paths.ts",
  "scripts/healthcheck.mjs",
  "scripts/healthcheck.test.mjs",
  "scripts/validate-deployment-env.mjs",
  "scripts/validate-deployment-env.test.mjs",
]);

const historicalStorybookPolicy = async () => {
  const latest = applicationPolicy();
  return {
    ...latest,
    phase: "storybook-verification",
    applicationReady: false,
    allowedFiles: historicalPublicationFiles(latest).filter(
      (file) =>
        !isGuidancePhaseFile(file) &&
        !applicationFiles.includes(file) &&
        (!operationsPrerequisiteFiles.includes(file) ||
          earlierPhaseDocuments.has(file) ||
          earlierOperationsSources.has(file)),
    ),
  };
};

const historicalGuidancePolicy = async () => {
  const latest = applicationPolicy();
  return {
    ...latest,
    phase: "assistant-guidance",
    applicationReady: false,
    allowedFiles: historicalPublicationFiles(latest).filter(
      (file) =>
        !applicationFiles.includes(file) &&
        (!operationsPrerequisiteFiles.includes(file) ||
          earlierPhaseDocuments.has(file) ||
          earlierOperationsSources.has(file) ||
          isGuidancePhaseFile(file) ||
          file === "scripts/check-guidance.test-support.mjs"),
    ),
  };
};

const historicalReleasePolicy = async () => {
  const latest = applicationPolicy();
  return {
    ...latest,
    phase: "release-prerequisites",
    applicationReady: false,
    allowedFiles: historicalPublicationFiles(latest).filter(
      (file) =>
        !applicationFiles.includes(file) &&
        !deferredApplicationPrerequisites.includes(file),
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
const repositoryFoundationFiles = [
  ...foundationFiles.filter((file) => !file.startsWith("src/")),
  ".github/workflows/codeql.yml",
];
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

test("accepts only the declared governance phase and publication schema", () => {
  assert.equal(validateBootstrapPolicy(policy()).size, coreFiles.length);
  for (const overrides of [
    { phase: "application" },
    { applicationReady: true },
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

test("repository foundation admits standalone CodeQL without admitting application or release workflows", () => {
  const security = ".github/workflows/codeql.yml";
  const current = foundationPolicy({
    phase: "repository-foundation",
    allowedFiles: repositoryFoundationFiles,
  });
  assert.ok(validateBootstrapPolicy(current).has(security));
  assert.equal(current.applicationReady, false);
  for (const file of [
    ".github/workflows/release.yml",
    ".github/workflows/dast.yml",
    "src/main.tsx",
  ])
    assert.throws(() =>
      validateBootstrapPolicy({
        ...current,
        allowedFiles: [...current.allowedFiles, file],
      }),
    );
});

test("repository foundation rejects snapshots omitting the CodeQL workflow and its declaration", async (context) => {
  const omitted = foundationPolicy({
    phase: "repository-foundation",
    allowedFiles: repositoryFoundationFiles.filter(
      (file) => file !== ".github/workflows/codeql.yml",
    ),
  });

  assert.throws(
    () => validateBootstrapPolicy(omitted),
    /mandatory guard files/,
  );
  const { root } = await fixture(context, omitted);
  await assert.rejects(inspectBootstrap(root), /mandatory guard files/);
});

test("repository foundation requires its verification toolchain and canonical Git guidance without application source", async (context) => {
  const guidance = [
    "AGENTS.md",
    ".agents/README.md",
    ".agents/rules/git.md",
    ".agents/rules/branches.md",
    ".agents/rules/safety.md",
    ".agents/rules/pull-requests.md",
    ".agents/skills/create-pr/SKILL.md",
    ".github/CODEOWNERS",
    "CONTRIBUTING.md",
    "docs/validation.md",
    "scripts/check-guidance.mjs",
    "scripts/check-guidance.test.mjs",
    "scripts/check-guidance.test-support.mjs",
  ];
  const current = foundationPolicy({
    phase: "repository-foundation",
    allowedFiles: [...repositoryFoundationFiles, ...guidance],
  });
  assert.equal(
    validateBootstrapPolicy(current).size,
    current.allowedFiles.length,
  );
  assert.equal(repositoryFoundationFiles.length, 13);
  assert.ok(current.allowedFiles.every((file) => !file.startsWith("src/")));
  for (const missing of repositoryFoundationFiles)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: current.allowedFiles.filter((file) => file !== missing),
        }),
      /mandatory/,
    );
  for (const file of [
    ...foundationFiles.filter((entry) => entry.startsWith("src/")),
    "src/main.tsx",
    "src/app/App.tsx",
    "src/shared/api/client.ts",
    "src/shared/i18n/catalogs.ts",
    "src/features/users/Users.tsx",
    "scripts/package-release.mjs",
    "deploy/docker/compose.yaml",
    ".env.example",
    ".env.local",
    ".agents/settings.local.json",
    ".agents/hooks/unlisted.mjs",
    ".claude/skills/unlisted/SKILL.md",
  ])
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: [...current.allowedFiles, file],
        }),
      /unique, exact paths/,
    );
  assert.throws(() =>
    validateBootstrapPolicy({ ...current, applicationReady: true }),
  );
  const { root } = await fixture(context, current);
  const result = await inspectBootstrap(root);
  assert.equal(result.phase, "repository-foundation");
  assert.equal(result.applicationReady, false);
  assert.equal(result.files, current.allowedFiles.length);
  assert.match(result.scope, /selected canonical assistant guidance/);
});

test("foundation requires every pure application primitive after the repository-only phase", () => {
  const primitives = foundationFiles.filter((file) => file.startsWith("src/"));
  assert.equal(primitives.length, 8);
  for (const missing of primitives)
    assert.throws(
      () =>
        validateBootstrapPolicy(
          foundationPolicy({
            allowedFiles: foundationFiles.filter((file) => file !== missing),
          }),
        ),
      /mandatory/,
    );
});

test("incremental guidance retains the imported helpers and executed hook owners", () => {
  for (const [owner, dependencies] of [
    [".agents/hooks/block-dangerous.sh", [".agents/hooks/block-dangerous.mjs"]],
    [
      "scripts/block-dangerous.test.mjs",
      [
        ".agents/hooks/block-dangerous.mjs",
        ".agents/hooks/block-dangerous.sh",
        "scripts/hooks.test-support.mjs",
      ],
    ],
    [
      "scripts/post-edit-format.test.mjs",
      [".agents/hooks/post-edit-format.sh", "scripts/hooks.test-support.mjs"],
    ],
    [
      "scripts/quality-gate.test.mjs",
      [".agents/hooks/quality-gate.sh", "scripts/hooks.test-support.mjs"],
    ],
    [
      "scripts/check-guidance.test.mjs",
      ["scripts/check-guidance.mjs", "scripts/check-guidance.test-support.mjs"],
    ],
    ["scripts/check-guidance.test-support.mjs", ["scripts/check-guidance.mjs"]],
  ]) {
    const current = foundationPolicy({
      phase: "repository-foundation",
      allowedFiles: [...repositoryFoundationFiles, owner, ...dependencies],
    });
    assert.equal(
      validateBootstrapPolicy(current).size,
      current.allowedFiles.length,
    );
    for (const missing of dependencies)
      assert.throws(
        () =>
          validateBootstrapPolicy({
            ...current,
            allowedFiles: current.allowedFiles.filter(
              (file) => file !== missing,
            ),
          }),
        /mandatory/,
      );
  }
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

test("publication inventories have no file-count cap", () => {
  const files = [
    ...foundationFiles,
    ...Array.from({ length: 110 }, (_, index) => `docs/topic-${index}.md`),
  ];
  assert.equal(
    validateBootstrapPolicy(foundationPolicy({ allowedFiles: files })).size,
    files.length,
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
  "tooling/paths.ts",
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
    "src/shared/api/path.ts",
    "src/shared/api/path.test.ts",
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
  assert.equal(
    validateBootstrapPolicy(current).size,
    current.allowedFiles.length,
  );
  const required = current.allowedFiles.filter(
    (file) =>
      (file.startsWith("src/") &&
        !runtimePolicy().allowedFiles.includes(file)) ||
      /^docs\/(?:authentication|development)\.md$/.test(file) ||
      file.startsWith("public/"),
  );
  assert.equal(required.length, 91);
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
  assert.equal(result.files, current.allowedFiles.length);
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
  assert.equal(
    validateBootstrapPolicy(current).size,
    current.allowedFiles.length,
  );
  const phaseFiles = current.allowedFiles.filter(isCoreAuthPhaseFile);
  assert.equal(phaseFiles.length, 38);
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
  assert.equal(result.files, current.allowedFiles.length);
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
  assert.ok(required.includes("scripts/deployment.test-support.mjs"));
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
  assert.equal(required.length, 34);
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
  const current = await historicalGuidancePolicy();
  assert.equal(current.phase, "assistant-guidance");
  assert.equal(
    validateBootstrapPolicy(current).size,
    current.allowedFiles.length,
  );
  const additions = current.allowedFiles.filter(isGuidancePhaseFile);
  assert.equal(
    additions.length,
    completeApplicationFiles.filter(isGuidancePhaseFile).length,
  );
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
  assert.equal(result.files, current.allowedFiles.length);
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

test("canonical guidance can be admitted incrementally without admitting unrelated source", async () => {
  const current = await historicalStorybookPolicy();
  for (const file of [
    ".agents/settings.json",
    ".agents/hooks/block-dangerous.mjs",
    "CLAUDE.md",
    "DESIGN.md",
    "scripts/check-guidance.mjs",
    "docs/validation.md",
  ]) {
    assert.equal(
      validateBootstrapPolicy({
        ...current,
        allowedFiles: [...current.allowedFiles, file],
      }).size,
      current.allowedFiles.length + 1,
    );
  }
  for (const file of [
    ".agents/hooks/unlisted.mjs",
    ".agents/settings.local.json",
    ".claude/skills/unlisted/SKILL.md",
  ])
    assert.throws(() =>
      validateBootstrapPolicy({
        ...current,
        allowedFiles: [...current.allowedFiles, file],
      }),
    );
});

test("release and quality prerequisites require their independent finite closure before application admission", async () => {
  const current = await historicalReleasePolicy();
  assert.equal(operationsPrerequisiteFiles.length, 62);
  for (const missing of operationsPrerequisiteFiles.filter(
    (file) => !deferredApplicationPrerequisites.includes(file),
  ))
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
  for (const file of operationsPrerequisiteFiles.filter(
    (entry) =>
      !earlierPhaseDocuments.has(entry) &&
      !earlierOperationsSources.has(entry) &&
      entry !== "scripts/check-guidance.integration.test.mjs" &&
      entry !== "scripts/check-guidance.test-support.mjs",
  ))
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
  const current = await historicalReleasePolicy();
  const { root, put } = await fixture(context, current);
  assert.equal(
    (await inspectBootstrap(root)).files,
    current.allowedFiles.length,
  );
  await put(
    "deploy/native/.env.local",
    "synthetic forbidden contents must never be parsed",
  );
  await assert.rejects(inspectBootstrap(root), /Unexpected bootstrap path/);
});

test("release prerequisites preserve full guidance and workshop closure without application admission", async (context) => {
  const current = await historicalReleasePolicy();
  assert.equal(
    validateBootstrapPolicy(current).size,
    current.allowedFiles.length,
  );
  for (const missing of [
    "AGENTS.md",
    ".agents/settings.json",
    ".storybook/vite.config.ts",
    "src/features/users/Users.tsx",
  ])
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: current.allowedFiles.filter((file) => file !== missing),
        }),
      /mandatory/,
    );
  assert.throws(() =>
    validateBootstrapPolicy({ ...current, applicationReady: true }),
  );
  const { root } = await fixture(context, current);
  const result = await inspectBootstrap(root);
  assert.equal(result.phase, "release-prerequisites");
  assert.equal(result.applicationReady, false);
  assert.match(result.scope, /finite release\/quality prerequisites/);
});

test("release prerequisites defer coupled application owners and admit only independent operational templates", async () => {
  const current = await historicalReleasePolicy();
  assert.equal(deferredApplicationPrerequisites.length, 11);
  for (const file of deferredApplicationPrerequisites)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: [...current.allowedFiles, file],
        }),
      /unique, exact paths/,
    );
  const templates = [
    ".github/workflows/codeql.yml",
    ".github/workflows/mutation.yml",
    ".github/workflows/release.yml",
    "stryker.config.json",
  ];
  assert.equal(
    validateBootstrapPolicy({
      ...current,
      allowedFiles: [...current.allowedFiles, ...templates],
    }).size,
    current.allowedFiles.length + templates.length,
  );
  for (const file of [
    ".github/workflows/dast.yml",
    ".github/workflows/staging.yml",
    ".github/workflows/deployment-smoke.yml",
    "staging.config.ts",
    "staging/setup.ts",
    "staging/staging.spec.ts",
    "smoke.config.ts",
    "smoke/setup.ts",
    "smoke/deployment.spec.ts",
  ])
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: [...current.allowedFiles, file],
        }),
      /unique, exact paths/,
    );
  const complete = applicationPolicy();
  for (const missing of operationsPrerequisiteFiles)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...complete,
          allowedFiles: complete.allowedFiles.filter(
            (file) => file !== missing,
          ),
        }),
      /mandatory/,
    );
});

test("the live publication policy validates independently of the complete application fixture", async () => {
  const current = JSON.parse(
    await readFile(
      new URL("../.github/bootstrap-policy.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(
    validateBootstrapPolicy(current).size,
    current.allowedFiles.length,
  );
  assert.equal(
    current.applicationReady,
    current.phase === "application-verification",
  );
  assert.equal(applicationPolicy().applicationReady, true);
  assert.equal(foundationPolicy().applicationReady, false);
});

test("application admission requires the exact runnable closure and matching readiness", async (context) => {
  const current = applicationPolicy();
  assert.equal(current.phase, "application-verification");
  assert.equal(current.applicationReady, true);
  assert.equal(
    validateBootstrapPolicy(current).size,
    current.allowedFiles.length,
  );
  for (const missing of applicationFiles)
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...current,
          allowedFiles: current.allowedFiles.filter((file) => file !== missing),
        }),
      /mandatory/,
    );
  assert.throws(() =>
    validateBootstrapPolicy({ ...current, applicationReady: false }),
  );
  const historical = await historicalGuidancePolicy();
  for (const file of applicationFiles.filter(
    (entry) => entry !== ".github/workflows/codeql.yml",
  ))
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...historical,
          allowedFiles: [...historical.allowedFiles, file],
        }),
      /unique, exact/,
    );
  const { root, put } = await fixture(context, current);
  await mkdir(path.join(root, "dist"));
  await put("dist/index.html", "<html>synthetic generated output</html>");
  assert.equal((await inspectBootstrap(root)).applicationReady, true);
  await put("e2e/undeclared.spec.ts", "// synthetic undeclared fixture");
  await assert.rejects(inspectBootstrap(root), /Unexpected bootstrap path/);
});

test("current application developer guides use English while historical phases and application translations remain intact", async () => {
  const latest = applicationPolicy();
  assert.equal(
    validateBootstrapPolicy(latest).size,
    latest.allowedFiles.length,
  );
  assert.ok(latest.allowedFiles.includes("src/shared/i18n/locales/fa.ts"));
  const historical = await historicalGuidancePolicy();
  const retiredCompanions = historical.allowedFiles.filter(
    (file) => file.endsWith(".fa.md") && !latest.allowedFiles.includes(file),
  );
  assert.equal(retiredCompanions.length, 27);
  assert.ok(latest.allowedFiles.includes("docs/validation.md"));
  assert.ok(!latest.allowedFiles.some((file) => /\.fa\.md$/i.test(file)));
  for (const file of [
    ...retiredCompanions,
    "docs/new-guide.FA.MD",
    "future/guide.fa.MARKDOWN",
    "docs/new-guide.Fa.MdX",
  ])
    assert.throws(
      () =>
        validateBootstrapPolicy({
          ...latest,
          allowedFiles: [...latest.allowedFiles, file],
        }),
      /declared phase/,
    );
  assert.throws(
    () =>
      validateBootstrapPolicy({
        ...latest,
        allowedFiles: latest.allowedFiles.filter(
          (file) => file !== "src/shared/i18n/locales/fa.ts",
        ),
      }),
    /mandatory/,
  );
  assert.ok(historical.allowedFiles.includes("docs/validation.fa.md"));
  assert.equal(
    validateBootstrapPolicy(historical).size,
    historical.allowedFiles.length,
  );
});
