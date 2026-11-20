# Import paths and ownership

Use `./` within the same source directory and `@/` across frontend source
directories. `@/` resolves to this checkout's `src/`. Pure catalog and calendar
data may use only their permitted local erased type edges; follow
[localization](localization.md).

## Source owners

Local source dependencies of the shared layer stay within `src/shared`. Keep
application composition in `src/app` and route shells in `src/layouts`. Features
own their screens, forms, `types.ts`, HTTP paths, local helpers and hooks within
`src/features/<feature>`. Keep helpers specific to a feature in that feature.

Keep shared infrastructure types beside the module that owns them. Shared
transport and its types live in `src/shared/api`. Framework-free appearance
contracts and shared constraints such as `profileNameMaxLength` live in
`src/shared/contracts`. Use `src/shared/hooks` for shared query-filter
handling, `src/shared/lib` for password generation and `src/shared/ui` for
reusable controls such as `ImageUpload`. The Files feature owns file services
and `src/features/roles/types.ts` owns permission contracts.

## Cross-feature imports

Each permitted edge names the importing file, the target public `index.ts` and
the exact runtime or erased export. Keep pages, forms, components and private
helpers inside their feature. Import and re-export edges follow the same rules.
Check the individual paths in [the boundary checker](../../scripts/check-boundaries.mjs).

| Consumer              | Permitted capabilities                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Login                 | `login` and erased `LoginParams` from Auth.                                                          |
| Register              | `register`, `useOtpRequest` and erased `RegisterParams` from Auth.                                   |
| Forgot Password       | `forgotPassword`, `useOtpRequest` and erased `ForgotPasswordParams` from Auth.                       |
| Account password form | `changePassword` and erased `ChangePasswordParams` from Auth.                                        |
| Account wire models   | Erased `PermissionKey` from Roles and `User` from Users.                                             |
| Settings              | `uploadFile` from Files in the page. Erased `FileContext` and `StoredFile` from Files in `types.ts`. |
| Users                 | `fetchRoles` from Roles in the page. Erased `Role` from Roles in the page, role form and `types.ts`. |
| Contents list         | `fetchContentCategories` and erased `ContentCategory` from Content Categories.                       |
| Content form          | `uploadFile` from Files and erased `ContentCategory` from Content Categories.                        |
| Content wire models   | Erased `ContentCategory` from Content Categories and `StoredFile` from Files.                        |

Feature screens may use only the app hooks, route configuration and access-policy
modules declared by the checker. Its authorized Account, Settings, Files,
Calendar, Roles, Users, FAQ, category and content screens and forms may also
import the erased `DefaultLayoutContext` through the default layout's public
index.

## Enforce ownership

The enforcement owner is the TypeScript AST boundary checker,
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

Root ESLint enforces its configured type-only imports and reports advisory
import/export sorting. Apply import fixes through the existing
[autofix workflow](code-quality.md#autofix-workflow). Keep the root project
independent of external project sources, backend implementation modules, local
package links, npm workspaces and retired multi-project directories.

## Type-only edges

Use `import type` or `export type` when every symbol in the declaration is used
only as a type. Use value imports for runtime references such as components,
classes, enum values and schema objects.
Use inline `type` specifiers in mixed imports and re-exports.
An erased edge must
obey the same ownership boundary. Leaf catalogs and calendar data accept only
the erased local types allowed by the boundary checker.
