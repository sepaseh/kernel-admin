# Import paths and ownership

Use `./` within the same source directory and `@/` across frontend source
directories. `@/` resolves to this checkout's `src/`. Pure catalog and calendar
data may use only their permitted local erased type edges; follow
[localization](localization.md).

Local source dependencies of the shared layer must stay within `src/shared`.
This excludes app, features, layouts and application entry points. Features own
their HTTP types, endpoint paths, local helpers and hooks. Shared transport stays in
`src/shared/api`; genuinely shared constraints such as `profileNameMaxLength`
stay in framework-free `src/shared/contracts`. Permission contracts belong to
`src/features/roles`. Do not move a feature-only helper into shared merely because
two files use it.

Keep feature dependencies inside their owner by default. A feature cannot import
another feature's page, form, component or private helper. The checker permits
only the declared source-file-to-module edges for the existing authentication
API/OTP capabilities and roles API/type vocabulary. These exceptions are defined
in `scripts/check-boundaries.mjs`; they are not blanket access to either feature.
Import the approved API, hook or type leaf directly. Cross-feature `index.ts`
targets require an explicit named capability: Settings may use the files upload
service and its erased `FileContext`/`StoredFile` models. Other feature barrels
remain rejected. Import and re-export edges follow the same exact module rules.
Type-only imports must use their declared erased contract edges.

Feature screens may use only the app hook, route configuration and access-policy
modules declared by the checker. Settings and Files may also import the erased
`DefaultLayoutContext` through the default layout's public index. Other app internals, providers, route shells
and entry points are outside the feature dependency interface. Keep application
composition in `app` and route shells in `layouts`.

The current enforcement owner is the TypeScript AST boundary checker,
[`scripts/check-boundaries.mjs`](../../scripts/check-boundaries.mjs), invoked by
`npm run check:boundaries`. It resolves static imports, erased types, re-exports,
dynamic imports and require edges against the published production inventory.
It confines local shared dependencies to shared production modules, restricts
feature-facing app interfaces and rejects undeclared cross-feature edges, in
addition to enforcing pure wire/catalog contracts and declared package
dependencies. The resolved module controls ownership, including imports through
aliases. Extend an ownership policy only for a reviewed requirement and add
positive and negative regressions for the intended capability and forbidden
internal access.

Root ESLint enforces its configured type-only imports and import/export sorting.
The boundary checker owns source dependency enforcement; ESLint does not replace
that check or enforce style-property ordering. Keep source independent of
external project sources, backend/database/auth/storage implementation, local
package links, npm workspaces and retired multi-project directories.

## Type-only edges

Use `import type` or `export type` for declarations used only as types. Mixed
imports/re-exports may mark individual type specifiers inline. Runtime components,
schemas, enum values and classes still require value imports. An erased edge must
obey the same ownership boundary; it does not bypass the published dependency
policy. Leaf catalogs and calendar data accept only the exact erased local types
allowed by the current boundary checker.
