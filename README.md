# Kernel Admin

[English](README.md) · [فارسی](README.fa.md)

Kernel Admin is one standalone React/Vite application using Ant Design/antd-style, React Router and Axios. The application-verification phase admits the application entry, composed routes, local HTTP adapters, all ten complete catalogs and the genuine application gate. Read [the exact policy](.github/bootstrap-policy.json) and [canonical manifest](.agents/validation.json); a readiness declaration never substitutes for an actual current-revision run.

Application startup belongs to [src/main.tsx](src/main.tsx), [App](src/app/App.tsx) and [Routes](src/app/Routes.tsx). Features own their screens, HTTP types and endpoints. Shared HTTP/session owners remain in src/shared/api; local pure DTO vocabulary stays in src/shared/contracts. The separate API owns authentication execution, authorization, database/migrations and storage. No source dependency on another checkout, workspace, backend SDK or local package is introduced.

The API owns active language, direction, calendar and names. The admin retains fixed Persian bootstrap and explicit retry on missing settings. Only theme and compact mode are visitor preferences. All ten local catalogs remain complete with matching interpolation; changing the active language requires the API's super-admin authorization.

Use the Node release in [.nvmrc](.nvmrc) and its bundled npm. Run npm ci, npm run browser:install and npm run validate -- full in an isolated export of the exact proposed snapshot. Use only explicit synthetic public configuration for source tests; no real environment, key, database, upload or production service is needed. The manifest owns every command and its order.

The full application profile preserves all inherited checks and adds unused-code analysis, production build, bundle budgets, consumer contracts, application browser journeys, visual comparison and Lighthouse. Browser fixtures are synthetic and fail on unexpected requests. Pact consumer tests do not verify the independent API provider. Visual comparison needs matching runtime/source provenance and actual human approval of fresh images; retained historical images are not current approval.

Authorized PRs are Ready for review and contain at most 100 actual changed-file entries. Commits, pushes, review requests, merges, remote protection changes and deployment retain explicit authorization boundaries. Publishing source or passing local checks does not establish a deployed service. Independent operator workflows remain deferred.

Start with [Contributing](CONTRIBUTING.md), [assistant guidance](.agents/README.md), [task navigation](docs/source-navigation.md), [architecture](docs/architecture.md), [validation](docs/validation.md) and [the documentation map](docs/README.md). Deployment, target verification and API-provider compatibility need their own authorization and genuine evidence.
