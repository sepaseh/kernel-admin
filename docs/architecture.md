# Application architecture

Use this overview to locate an application responsibility before changing its implementation. For setup, follow [usage](usage.md); for an implementation workflow, follow [development](development.md).

Kernel Admin is one independent React/Vite TypeScript application. Developers select a compatible backend through `VITE_API_BASE_URL`. That service owns authentication execution, authorization, database access and storage; this repository owns the panel, local catalogs and [HTTP contracts and examples](authentication.md#backend-integration). No particular backend repository or other checkout is required.

## Follow startup

1. [The entry point](../src/main.tsx) initializes observability and mounts [App](../src/app/App.tsx).
2. [`CoreProvider`](../src/app/providers/core/Core.tsx) loads public settings through the shared read lifecycle. The settings adapter validates language, logos and both palettes before Core accepts them. Bootstrap loading remains outside Ant Design.
3. `App` loads the Ant Design provider, settings feedback and routes together when settings are ready or a bootstrap error needs themed retry feedback. Routes mount only after validated palettes are available. Later settings refresh failures retain the accepted application.
4. [Routes](../src/app/Routes.tsx) builds the data router from the [route metadata](../src/app/config/routes.ts). Public layout and page modules can load together. The router checks protected page access before running its lazy importer and sends allowed import failures to the route error fallback.

The [default layout](../src/layouts/default/Default.tsx) loads the current account before rendering protected children. Menu and route checks describe what the client presents; the API authorizes each request independently.

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

Features may consume another feature only through the exact authentication API/OTP and roles API/type edges declared by [the boundary checker](../scripts/check-boundaries.mjs). Approved consumers import those leaves directly; cross-feature screens, forms, helpers and feature barrels are rejected. Feature screens use only the declared app hook, route configuration and access-policy interfaces; app internals, providers, layouts and entry points are outside that interface. The [import rules](../.agents/rules/imports.md) describe enforcement and how to review a new dependency.

## Trace a change

Use the [source map](source-navigation.md) to find the nearest implementation and tests. [Route tests](../src/app/Routes.test.tsx) exercise startup and lazy-route behavior. [Core tests](../src/app/providers/core/Core.test.tsx) exercise settings acceptance. Feature behavior stays with its tests and stories.

[Testing](testing.md) explains what each kind of evidence establishes. Component, consumer-contract and application-browser results cover different boundaries; provider compatibility and deployed behavior require their own results.
