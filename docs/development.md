# Develop Kernel Admin

Use this workflow for a change to an existing screen, form or frontend contract. Complete [local setup](usage.md) first, then work in the existing checkout under the [working-checkout rule](../.agents/rules/branches.md#working-checkout). Inspect the current branch and changes before editing; preserve unrelated tracked, staged and untracked work.

Keep one root npm project with source in `src/`. Developers choose the backend through the local [HTTP integration boundary](authentication.md#backend-integration); do not add workspaces, backend SDKs, local-package links or source imports from another checkout.

## 1. Define the behavior and find its owner

Describe the user-visible result and the failure it must handle. For example, a list refresh failure should keep accepted rows and offer retry. Read the closest implementation and tests before selecting an abstraction.

Use the [architecture owner map](architecture.md#locate-the-owner) to locate startup, routes, providers and shared infrastructure. Read the feature API, types, forms and nearby tests in `src/features/<feature>`. Cross-feature appearance vocabulary and the profile-name limit belong in `src/shared/contracts`.

## 2. Change the owning contract and interaction

Keep endpoint paths and HTTP request/response types in the feature's `api.ts` and `types.ts`. Normalize nullable data at that boundary. Keep transport/session behavior in `src/shared/api`; document incompatible HTTP or permission changes and the requirements for a compatible backend.

Before importing from another feature or app module, check the [dependency boundaries](architecture.md#feature-dependency-boundaries) and the exact approved edges in [the checker](../scripts/check-boundaries.mjs). Use reviewed named authentication or roles API, hook or erased type exports through the owning public `index.ts`, and the approved app hooks, route configuration or access policy. Preserve the checker's exact named edges. Keep another feature's UI/private helpers and app composition internals out of the dependency. A new dependency needs a reviewed ownership requirement and positive/negative boundary regressions. Keep a feature-specific abstraction local until a real shared contract is needed.

Follow the owning screen's direct request lifecycle. Authentication, account and business screens own cancellation in their effects and submit handlers, with synchronous submission locks where needed. Include every filter and identifier in request identity and forward the supplied cancellation signal to the feature API. Preserve session generations and stale-result guards described in [authentication and requests](authentication.md). Reuse shared filter hooks and library helpers instead of copying query parsing or password generation into a feature.

For a drawer form, follow the page-owned navigation pattern used by [Contents](../src/features/contents/Contents.tsx). The form calls `onClose` on cancellation or failure to open and `onFinish` after a successful save. The page handles navigation and starts the list refresh after a save. Preserve [ImageUpload's](../src/shared/ui/image-upload/ImageUpload.tsx) ownership of upload cancellation when it unmounts.

For interface changes, read [DESIGN](../DESIGN.md), the closest `*.stories.tsx`, and the canonical [React](../.agents/rules/react.md) and [styling](../.agents/rules/styling.md) rules. Keep React, Ant Design/antd-style, React Router and Axios. Reuse component props and semantic tokens before adding custom styling.

Cover the relevant populated, empty, loading, initial failure, retained-data refresh failure, validation, submitting and permitted/read-only states. Preserve native keyboard interaction, reduced motion, narrow layouts, RTL/LTR and light/dark/compact behavior.

## 3. Connect routes, permissions and labels

When adding a route, define its path, layout and access metadata in [route configuration](../src/app/config/routes.ts), then connect its page importer in [Routes](../src/app/Routes.tsx). Add a navigation entry only when the product needs one. Keep access decisions in the existing [pure policy](../src/app/lib/access.ts). Client visibility and guards do not enforce server authorization.

Reuse translated labels where their meaning matches. Add a new key to every registered catalog when needed, preserving interpolation names and genuine translations. Follow [localization](localization.md); language, direction and calendar remain API-owned, while theme and compact mode are browser preferences.

## 4. Verify the behavior

Add or update tests beside the changed owner. Cross-module cases belong in `src/test/integration`; shared render helpers live in `src/test/render.tsx`. Use complete feature API/client mocks or the declared synthetic HTTP fixtures, and make unexpected requests fail. [Testing](testing.md) explains which evidence each suite supplies.

After installing locked dependencies, run the relevant cases from the repository root. For a user-list change, use the local Vitest runner to check the page and its adapter.

```sh
npm exec --no -- vitest run src/features/users/Users.test.tsx src/features/users/api.test.ts
```

Check the output for both selected files and review any failed assertions before expanding scope. Cover the affected success, failure, cancellation and permission behavior.

Run `npm run check:boundaries` after changing imports or ownership. When extending an approved edge, also run its focused [boundary tests](../scripts/check-boundaries.test.mjs) and confirm that unrelated feature internals and upward shared imports still fail.

Use the current type, lint and broader check commands from [the manifest](../.agents/validation.json). Follow [validation](validation.md) for the complete required gate before an authorized commit, push or handoff. A focused run does not replace that gate.

## 5. Update the guide that owns the change

Update the existing usage, contract, testing or deployment guide when its instructions or behavior change. Link to configuration and command owners instead of copying another complete inventory. Keep documentation in English and product catalogs complete.

Keep scratch exports, generated evidence and recovery files in ignored directories inside this repository; validation exports are verification-only and must never become implementation checkouts. Keep real local configuration out of source fixtures and commits. Use [Contributing](../CONTRIBUTING.md) for review and publication; preparing or testing a change does not grant permission to publish it.

## Own build artifacts during publication

Follow the [deployment procedures](deployment.md) when producing release artifacts. Run build stamping and release packaging after the builder has stopped. The invoking account must exclusively control the canonical build parent and the helpers' newly created workspace. Keep concurrent builders and publishers away from those paths. The helpers isolate the build entry in a private sibling directory, validate opened file identities, and restore the build after the operation. Processes running under the same account or holding existing write handles can still access it.

If the public build path is occupied and restoration fails, keep the reported recovery directory. After an interruption, inspect `.kernel-build-*/build` or `.kernel-release-*/build` beside the original build path. The helpers leave occupied build contents in place. Restore the retained directory only after confirming the original path is free and its publisher has stopped.
