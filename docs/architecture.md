# Application architecture

Use this overview to locate an application responsibility before changing its implementation. For setup, follow [usage](usage.md); for an implementation workflow, follow [development](development.md).

Kernel Admin is one independent React/Vite TypeScript application. Developers select a compatible backend through `VITE_API_BASE_URL`. That service owns authentication execution, authorization, database access and storage; this repository owns the panel, local catalogs and [HTTP contracts and examples](authentication.md#backend-integration). No particular backend repository or other checkout is required.

## Follow startup

1. [The entry point](../src/main.tsx) initializes observability and mounts [App](../src/app/App.tsx).
2. [`CoreProvider`](../src/app/providers/core/Core.tsx) loads public settings with an owned cancellation signal. It displays loading or an inline retry before exposing accepted settings to its children. The settings API uses typed response models without runtime envelope validation.
3. `App` composes the Ant Design provider, shared global styles and lazy routes after settings are available. Ant Design applies the API-owned palette, language and direction, together with browser theme and compact preferences.
4. [Routes](../src/app/Routes.tsx) builds the data router from the [route metadata](../src/app/config/routes.ts). Public layout and page modules can load together. The router checks protected page access before running its lazy importer and sends allowed import failures to the route error fallback.

The [default layout](../src/layouts/default/Default.tsx) loads the current account before rendering protected children. It exposes that account, account reload and session cleanup through its typed Outlet context. Menu and route checks describe what the client presents; the API authorizes each request independently.

## Locate the owner

| Responsibility                                                | Owner                                             | Contract                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Accepted settings, account context and appearance preferences | [Core](../src/app/providers/core/Core.tsx)        | Server settings remain authoritative; the browser persists theme and compact mode.        |
| Paths, wire types and response validation for a feature       | `src/features/<feature>/api.ts` and `types.ts`    | Keep the contract with its feature.                                                       |
| Credentials and HTTP behavior                                 | [`src/shared/api`](../src/shared/api)             | Memory-only tokens, generation checks, bounded refresh, conversion and normalized errors. |
| Read and mutation state                                       | [`src/shared/hooks`](../src/shared/hooks)         | Cancellation, current-resource identity and stale-result protection.                      |
| Shared product vocabulary                                     | [`src/shared/contracts`](../src/shared/contracts) | Reuse limits and appearance contracts across features.                                    |
| Catalog data and runtime adapters                             | [`src/shared/i18n`](../src/shared/i18n)           | Keep pure catalog/calendar data separate from UI and vendor initialization.               |

The API selects language, text direction, calendar, logos and palettes. A browser theme choice selects which accepted palette to display; it does not change the global settings contract. See [localization](localization.md) and [authentication and requests](authentication.md) for the detailed lifecycles.

## Feature dependency boundaries

Keep screens, APIs, request/response types, forms, hooks and tools with their owning `src/features/<feature>`. Shared modules provide domain-independent infrastructure and controls; their local source dependencies stay within `src/shared`. Application composition belongs in `app`, and route shells belong in `layouts`.

Features use only the exact authentication API/OTP, roles API/type and settings-to-files capabilities declared by [the boundary checker](../scripts/check-boundaries.mjs). Settings imports the reviewed file upload service and erased file models through the files public exports. Settings and Files may import the erased `DefaultLayoutContext` from the default layout; layout components and other internals remain private. The [import rules](../.agents/rules/imports.md) describe enforcement and how to review a new dependency.

## Trace a change

Start with the responsibility above and read its implementation and nearby tests. [Route tests](../src/app/Routes.test.tsx) exercise startup and lazy-route behavior. [Core tests](../src/app/providers/core/Core.test.tsx) exercise settings acceptance. Feature behavior stays with its tests and stories.

[Testing](testing.md) explains what each kind of evidence establishes. Component, consumer-contract and application-browser results cover different boundaries; provider compatibility and deployed behavior require their own results.
