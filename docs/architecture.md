# Kernel Admin architecture

Use this overview to locate an application responsibility before changing its implementation. For setup, follow [usage](usage.md); for an implementation workflow, follow [development](development.md).

Kernel Admin is a standalone React and Vite client written in TypeScript. The configured backend handles authentication, authorization, data and storage. This repository owns the panel, local catalogs and the HTTP boundary it expects from a compatible service. [Backend integration](authentication.md#backend-integration)

## Follow startup

1. The entry point loads the root styles and mounts `App` under React Strict Mode. `App` puts `CoreProvider` inside the application error boundary. [Entry point](../src/main.tsx) · [Application composition](../src/app/App.tsx)
2. `CoreProvider` loads public settings before it renders any routes, including sign-in. It shows a loading indicator or a retry action until it accepts a response. [Core provider](../src/app/providers/core/Core.tsx)
3. With settings available, `App` renders the Ant Design provider, global styles and lazy router. UI libraries use the settings metadata and the browser's theme and compact preferences. [Localization](localization.md#runtime-metadata)
4. The browser router pairs route metadata with page and layout loaders and uses the configured application base path. Public page and layout modules can load together. Protected pages load only after the layout accepts the current user and the route access check passes. A denied route redirects to the dashboard. A permitted route whose module fails to load reaches the route error fallback. [Router](../src/app/Routes.tsx) · [Route definitions](../src/app/config/routes.ts) · [Route tests](../src/app/Routes.test.tsx)

The default layout derives available navigation from the current user. It keeps accepted data and the `Outlet` mounted while identity refreshes or a retryable refresh fails. It exposes the current user, an awaitable reload and session cleanup through its outlet context. The API authorizes each request independently. [Default layout](../src/layouts/default/Default.tsx) · [Access helpers](../src/app/lib/access.ts) · [Request lifecycles](authentication.md#read-resources)

## Locate the owner

| Responsibility                                    | Owner                                                        | Contract                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Accepted settings and appearance preferences      | [Core](../src/app/providers/core/Core.tsx)                   | Server settings remain authoritative; the browser persists theme and compact mode.        |
| Paths, wire types and HTTP adapters for a feature | `src/features/<feature>/api.ts` and `types.ts`               | Keep the contract with its feature.                                                       |
| Credentials and HTTP behavior                     | [`src/shared/api`](../src/shared/api)                        | Memory-only tokens, generation checks, bounded refresh, conversion and normalized errors. |
| Read and mutation state                           | Owning feature and [`src/shared/hooks`](../src/shared/hooks) | Direct request cancellation, submission locks and session-generation guards.              |
| Shared product vocabulary                         | [`src/shared/contracts`](../src/shared/contracts)            | Reuse the profile-name limit and appearance contracts across features.                    |
| Catalog data and runtime adapters                 | [`src/shared/i18n`](../src/shared/i18n)                      | Keep pure catalog/calendar data separate from UI and vendor initialization.               |

## Feature dependency boundaries

Keep screens, APIs, request/response types, forms, hooks and tools with their owning `src/features/<feature>`. Shared modules provide domain-independent infrastructure and controls; their local source dependencies stay within `src/shared`. Application composition belongs in `app`, and route shells belong in `layouts`.

The boundary checker lists the permitted cross-feature services and type imports. For example, Contents reads categories through the category feature's public entry and uploads cover images through the Files entry. Protected screens consume the erased `DefaultLayoutContext` through the default layout's public entry. Check the approved edges before introducing a dependency. [Boundary checker](../scripts/check-boundaries.mjs) · [Import rules](../.agents/rules/imports.md)

Content forms use the shared lazy rich-text editor for headings, emphasis, block quotes and ordered or unordered lists. Loaded and pasted links become ordinary text while those basic formats remain available. After a successful deletion, the contents list returns to its first page while retaining the active filters. Closing the content form removes its cover field and resets the form. The image uploader cancels its active request when it unmounts.

Pages open drawers with an action hash and store the selected record ID in the edit history entry. Back and Forward restore the corresponding record. A direct edit URL without an ID returns to the list. The form owns permission checks, validation and request cancellation, then calls `onClose` on cancellation or failure to open. A successful save calls `onFinish`, which starts a list refresh and closes the drawer immediately. [Drawer history helpers](../src/shared/hooks/useGoBack.ts) · [Contents page](../src/features/contents/Contents.tsx)

## Trace a change

Start with the responsibility above and read its implementation and nearby tests. [Route tests](../src/app/Routes.test.tsx) exercise startup and lazy-route behavior. [Core tests](../src/app/providers/core/Core.test.tsx) exercise settings acceptance. Feature behavior stays with its tests and stories.

[Testing](testing.md) explains what each kind of evidence establishes. Component, consumer-contract and application-browser results cover different boundaries; provider compatibility and deployed behavior require their own results.
