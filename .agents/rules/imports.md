# Import paths and ownership

Use `./` within the same source directory and `@/` across frontend source
directories. `@/` resolves to this checkout's `src/`. Pure catalog and calendar
data may use only their permitted local erased type edges; follow
[localization](localization.md).

The shared layer cannot import app, features or layouts. Features own their HTTP
types, endpoint paths, local helpers and hooks. Shared transport stays in
`src/shared/api`; genuinely shared constraints such as `profileNameMaxLength`
stay in framework-free `src/shared/contracts`. Permission contracts belong to
`src/features/roles`. Do not move a feature-only helper into shared merely because
two files use it.

The current enforcement owner is the TypeScript AST boundary checker,
[`scripts/check-boundaries.mjs`](../../scripts/check-boundaries.mjs), invoked by
`npm run check:boundaries`. It resolves static imports, erased types, re-exports,
dynamic imports and require edges against the published production inventory.
It enforces exact local ownership and declared package dependencies; a public
barrel does not grant a new cross-feature edge. Extend an ownership policy only
for a reviewed requirement and add its negative regressions.

Root ESLint enforces its configured type-only imports and import/export sorting.
It does not currently provide the future local ownership or style-property
rules. Never claim an unpublished rule is running. Keep source independent of
other checkouts, API/database/auth/storage implementation, local package links,
`@kernel/*`, npm workspaces and retired multi-project directories.

## Type-only edges

Use `import type` or `export type` for declarations used only as types. Mixed
imports/re-exports may mark individual type specifiers inline. Runtime components,
schemas, enum values and classes still require value imports. An erased edge must
obey the same ownership boundary; it does not bypass the published dependency
policy. Leaf catalogs and calendar data accept only the exact erased local types
allowed by the current boundary checker.
