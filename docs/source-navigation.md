# Source navigation

[English](source-navigation.md) · [فارسی](source-navigation.fa.md)

The current `assistant-guidance` publication retains `applicationReady: false`. Use [the machine task map](../.agents/navigation.json) to choose current owners, contracts, rules and checks. Read those owners; the map does not establish behavior or automatic instruction loading.

For business modules, start with `src/app/config/routes.ts`, `src/app/lib/access.ts` and the owning `src/features/<feature>` API, types, component and tests. Route metadata and reusable layouts are published; application entry and App/Routes composition are not. Shared transport/session generations and request-intent binding live in `src/shared/api` and `src/shared/hooks`; read [request reliability](admin-request-reliability.md). The published hook regression is `src/shared/hooks/useReadResource.test.ts`.

Permission types belong in `src/features/roles/types.ts`; pagination and URL filters in `src/features/users/types.ts` and `src/features/users/hooks`; password generation in `src/features/users/tools`. Logo upload helpers and tests belong in `src/features/settings/components/logo-upload`. The cross-feature profile-name limit stays in `src/shared/contracts`, while transport types stay in `src/shared/api/types.ts`.

Each of the ten code-named files in `src/shared/i18n/locales` has the same 111 complete root string messages. `catalogs.ts` loads those objects; `index.ts` owns i18next initialization with Persian bootstrap fallback; `date.ts` registers vendor Day.js locales, local `dayjs/fa.ts` and Jalaliday. The catalog code selects an adapter only. The API owns active language, direction, calendar and names: trace settings reply validation, Core settings loading, AntdProvider mapping and Settings super-admin guards. Browser storage owns theme/compact preferences only.

For visual work, read [DESIGN](../DESIGN.md), [the design workflow](../.agents/skills/design-ui/SKILL.md), `src/shared/config/theme.ts`, existing widgets and the closest `*.stories.tsx`. The isolated `.storybook` configuration fully mocks feature APIs and the shared client. Chromium provides component interaction/accessibility evidence; application E2E, real provider contracts, reviewed visual baselines and deployment remain later work. Unpublished `e2e` or `contract` paths are not current verification owners.

For issues, branches, commits and PRs, use [Git workflow](../.agents/rules/git.md), [branch rules](../.agents/rules/branches.md), [commit skill](../.agents/skills/commit/SKILL.md) and [issue startup](../.agents/skills/start-issue/SKILL.md). Read [validation](validation.md), [ADRs](adr/README.md), [evaluation](comprehension-evaluation.md) and [the documentation map](README.md). The separate API and website own their implementations; this checkout consumes compatible HTTP and owns its catalogs independently.
