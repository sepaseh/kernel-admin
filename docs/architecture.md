# Application architecture

Use this overview to locate an application responsibility before changing its implementation. For setup, follow [usage](usage.md); for an implementation workflow, follow [development](development.md).

Kernel Admin is one independent React/Vite TypeScript application. Developers select a compatible backend through `VITE_API_BASE_URL`. That service owns authentication execution, authorization, database access and storage; this repository owns the panel, local catalogs and [HTTP contracts and examples](authentication.md#backend-integration). No particular backend repository or other checkout is required.

## Follow startup

1. [The entry point](../src/main.tsx) initializes [optional observability](../src/shared/lib/observability.ts), then mounts [App](../src/app/App.tsx).
2. [`CoreProvider`](../src/app/providers/core/Core.tsx) loads public settings with local state and cancellation. The settings adapter returns typed language, logos and palettes without runtime validation. Bootstrap loading remains outside Ant Design.
3. `App` composes the Ant Design provider, global styles and lazy routes. Core renders its children after settings are available and offers bootstrap retry.
4. [Routes](../src/app/Routes.tsx) builds the data router from the [route metadata](../src/app/config/routes.ts). Public layout and page modules can load together. The router checks protected page access before running its lazy importer and sends allowed import failures to the route error fallback.

The [default layout](../src/layouts/default/Default.tsx) loads the current account before rendering protected children. Menu and route checks describe what the client presents; the API authorizes each request independently.

Observability collects `window.error`, unhandled promise rejections, React error-boundary failures and router error-fallback failures. It reports the supported Web Vitals CLS, FCP, INP, LCP and TTFB, plus long-task durations when available. Events use the public release ID and sanitized error/context data. Delivery is optional: a blank receiver URL sends no default network reports, and `setObservabilityTransport` accepts a custom transport.

## Locate the owner

| Responsibility                                    | Owner                                                              | Contract                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Accepted settings and appearance preferences      | [Core](../src/app/providers/core/Core.tsx)                         | Server settings remain authoritative; the browser persists theme and compact mode.        |
| Current account and protected-page context        | [Default layout](../src/layouts/default/Default.tsx)               | Load the account before protected children and expose it through Outlet context.          |
| Paths, wire types and HTTP adapters for a feature | `src/features/<feature>/api.ts` and `types.ts`                     | Keep the contract with its feature.                                                       |
| Credentials and HTTP behavior                     | [`src/shared/api`](../src/shared/api)                              | Memory-only tokens, generation checks, bounded refresh, conversion and normalized errors. |
| Read and mutation state                           | Owning page/provider and [`src/shared/hooks`](../src/shared/hooks) | Local state, cancellation and synchronous submission locks.                               |
| Shared product vocabulary                         | [`src/shared/contracts`](../src/shared/contracts)                  | Reuse appearance contracts across features.                                               |
| Catalog data and runtime adapters                 | [`src/shared/i18n`](../src/shared/i18n)                            | Keep pure catalog/calendar data separate from UI and vendor initialization.               |

The API selects language, text direction, calendar, logos and palettes. A browser theme choice selects which accepted palette to display; it does not change the global settings contract. See [localization](localization.md) and [authentication and requests](authentication.md) for the detailed lifecycles.

## Feature dependency boundaries

Keep screens, APIs, request/response types, forms, hooks and tools with their owning `src/features/<feature>`. Shared modules provide domain-independent infrastructure and controls; their local source dependencies stay within `src/shared`. Application composition belongs in `app`, and route shells belong in `layouts`.

Features consume reviewed API, hook or type exports through another feature's public `index.ts`; cross-feature screens, forms and private helpers remain outside that interface. Feature screens use app hooks, route configuration, access policy and public layout context; app composition internals remain with their owner. The [boundary checker](../scripts/check-boundaries.mjs) and [import rules](../.agents/rules/imports.md) describe enforcement and how to review a new dependency.

## Trace a change

Start with the responsibility above and read its implementation and nearby tests. [Route tests](../src/app/Routes.test.tsx) exercise startup and lazy-route behavior. [Core tests](../src/app/providers/core/Core.test.tsx) exercise settings acceptance. Feature behavior stays with its tests and stories.

[Testing](testing.md) explains what each kind of evidence establishes. Component, consumer-contract and application-browser results cover different boundaries; provider compatibility and deployed behavior require their own results.
