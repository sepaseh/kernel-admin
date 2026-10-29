# Source navigation

[English](source-navigation.md) · [فارسی](source-navigation.fa.md)

Read [the task map](../.agents/navigation.json), [publication policy](../.github/bootstrap-policy.json) and [canonical manifest](../.agents/validation.json). The application-verification phase admits the runnable standalone panel and its complete gate; navigation is a map, not proof of execution, provider compatibility, host instruction loading or deployment.

Startup and composition belong to src/main.tsx, src/app/App.tsx and src/app/Routes.tsx. Route metadata and pure permission decisions remain in src/app/config/routes.ts and src/app/lib/access.ts. Composed access/failure regressions are in src/app/Routes.test.tsx and src/test/integration/pages.test.tsx. Features retain their own components, wire types and HTTP adapters; shared request/session generations stay in src/shared/api and src/shared/hooks. Read [request reliability](admin-request-reliability.md).

Permission vocabulary belongs to roles/types.ts; user pagination/URL filters to users/types.ts and its hooks; password generation to users/tools. Logo upload helpers stay in settings/components/logo-upload. Pure cross-feature contracts remain in src/shared/contracts. No application frontend imports another checkout, workspace or API implementation.

The ten complete code-named catalogs retain 111 matching messages and interpolation. src/shared/i18n/catalogs.ts owns selection, index.ts initializes fixed Persian bootstrap, and date.ts owns vendor Day.js/Jalaliday adapters. API settings own language, direction, calendar and names; local maps only select vendor/catalog adapters. Browser storage owns theme and compact only. Read [localization](localization.md).

For UI changes, read [DESIGN](../DESIGN.md), [the design workflow](../.agents/skills/design-ui/SKILL.md), theme/config owners and the nearest story. Storybook retains full owner mocks and blocking Chromium accessibility checks. Application fixtures in e2e and consumer interactions in contract add distinct evidence; none verifies the independent API provider. Visual configuration/readiness and matching provenance live in playwright.visual.config.ts, e2e/visual and scripts/visual-environment.mjs. Human approval of every fresh image remains mandatory.

Vite/build ownership lives in vite.config.ts and the declared root scripts. Bundle budgets, import-safe Lighthouse/visual orchestration and metadata stamping retain their pure/synthetic lifecycle tests. Real application checks use explicitly synthetic configuration and exclusively owned processes/ports. Read source before calling an operational CLI; deployment helpers can write selected files or contact a target. Real environment/state is never a source fixture.

Use [Git workflow](../.agents/rules/git.md), [branch rules](../.agents/rules/branches.md), [validation](validation.md), [ADRs](adr/README.md) and [the documentation map](README.md) for handoff. Independent operator automation, actual API-provider verification and deployment retain separate authorization and evidence. Historical Win32 assets remain [dated provenance](visual-regression.md), never current approval.
