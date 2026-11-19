# Admin conventions

Keep Ant Design and antd-style as the UI/theme foundation, React Router for
routes, Axios for HTTP and app-owned i18next for runtime translation. Use direct
named `lucide-react` imports with explicit sizes, `currentColor` and decorative
`aria-hidden`; do not add icon registries or Material SVG copies.

Use `./` in the same source directory and `@/` across source directories. Features
own API/types/components; `shared` must not import app/features/layouts. Cross-feature
imports use only the exact approved named API, hook or erased type exports in
[the import policy](imports.md); feature barrels are not a blanket public interface.
HTTP types and paths stay with their feature;
transport contracts stay in `src/shared/api` and shared appearance/profile limits in
`src/shared/contracts`. Query filters belong to shared hooks and password generation
to shared library helpers, image uploads
to shared UI with file services in files, and permission contracts to roles. Frontends never import backend
API/database/auth/storage modules.
These alias conventions apply to `src`; pure catalog data references local
data modules within `src/shared/i18n`.

Use named `type` shapes and existing component/hook conventions. Prefer derived
state and accessible controls. Use the owning screen's direct request lifecycle with `useAbortController` and `useLock`, preserving cancellation and submission locks. Preserve request
identity across retries and authentication changes. See
[request reliability](../../docs/authentication.md).
Use root ESLint for configured import/type rules and the AST boundary checker for
published ownership. Style-property conventions still require direct review;
unimplemented local ESLint rules are not running. Keep behavior tests
deterministic and isolated Storybook cases synthetic. Do not widen
snapshot thresholds or change baselines to hide failures.
