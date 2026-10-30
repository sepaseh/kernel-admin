# Admin architecture

[English](architecture.md) · [فارسی](architecture.fa.md)

Scope updated: 29 October 2026. The application-verification phase admits a standalone React/Vite panel, src/main.tsx startup, App/provider/error-boundary composition and Routes with lazy feature/layout modules. Ant Design/antd-style, React Router, Axios and complete local language adapters remain the foundations. Every inherited component/HTTP/workshop check remains in the full gate, supplemented by genuine production build, consumer contracts, application browser/accessibility/visual and Lighthouse checks.

Actual execution is recorded per exact revision. API-provider compatibility, fresh human visual approval, deployment and optional host evaluation are separate evidence; a readiness declaration or synthetic fixture cannot establish them.

Before settings and appearance modules are ready, App renders a localized native status. Ant Design route loaders remain inside the themed application, avoiding an initial default-theme spinner mount.

Date plugins and all ten locales register at startup; localized Jalali month names are cached per locale on first access, so Gregorian startup does not build unused month labels.

Each feature owns its published HTTP types, endpoints and helpers. Authentication
forms call the auth owner; the default layout reads the account owner; the
permission key type belongs to roles. Import an existing owning module rather
than an unpublished facade. `src/shared/api` owns transport/session infrastructure
and its types. `src/shared/contracts` owns the cross-feature profile-name limit
and pure appearance vocabulary. Shared modules stay independent of app, features
and layouts. Frontend aliases resolve inside `src`; another checkout, an internal
package publication or a backend SDK is not a source dependency.

Local `src/shared/i18n` has one complete flat code-named catalog per language.
`catalogs.ts` registers the objects and `index.ts` owns i18next initialization.
Global theme/compact preferences, theme creation, request hooks and reusable UI
remain shared. The app layer owns Core context/providers and navigation metadata;
layouts own shell and account-check behavior. [Core and authentication](core-auth.md)
describes these published owners and their limits.

[Storybook verification](storybook-verification.md) is test infrastructure. Its
dedicated Vite config disables environment-file loading and supplies synthetic
configuration. Preview full automocks replace all feature API owners and the
shared client; unexpected client calls fail closed. Synthetic Core/router/Ant
Design providers isolate stories from application startup. Explicit English/Persian
server metadata fixtures drive translation/calendar while independent direction
and theme controls exercise appearance. None creates a production visitor language
chooser or replaces server authorization.

The independent API owns authentication execution, authorization, database,
migrations and storage. The admin consumes it over HTTP; menus are convenience
controls, not authorization. Bearer credentials remain memory-only, refresh is
single-flight, replay is bounded and request generation protects a newer login.
Optional auth abort signals also prevent an aborted login/registration response
from installing a token. Cancellation cannot undo a committed server mutation or
cookie side effect. Server-session revocation remains an API operation.

The public website is a separate consumer with its own source and rollout. No API
or website implementation, deployment or security result is freshly verified by
this admin snapshot. Coordinate incompatible wire changes and rollout with those
owners and verify each repository separately.

Active language belongs to public API settings; changing it requires API-side
super-admin authorization. Core loads settings on mount and revalidates on focus.
It keeps validated code, direction, calendar and names together; i18next and
Day.js follow them, while Ant Design selects the vendor locale and applies the
document language/direction. Fixed Persian bootstrap and retry feedback do not
create a visitor preference. Only theme and compact settings persist in browser
storage. The [business settings/calendar modules](business-screens.md) use this metadata without introducing a visitor language preference.

Unsupported or malformed language metadata produces an explicit settings error,
never a local override. Local maps select supported vendor locales and translate
the calendar name `gregorian` to Day.js `gregory`; they do not infer the server's
direction or calendar. Read [ADRs](adr/README.md), [HTTP ownership](http-client.md),
[request lifecycle](request-lifecycle.md), [request reliability](admin-request-reliability.md),
[localization](localization.md) and the [publication/full-gate policy](bootstrap.md).
