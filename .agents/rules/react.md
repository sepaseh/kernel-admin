# React

These Ant Design, i18next, icon and React Router conventions apply to this standalone admin. Keep components, hooks and accessibility consistent with the existing source.

The admitted application includes shared controls, hooks, core providers,
authentication screens, route composition and feature screens.

## Components

- Keep one exported React component per `.tsx` file when practical.
- When a function component receives props, define a component-specific named
  `type` and annotate its props parameter directly; infer the return type and
  do not use `FC` or another component-function type. Components without props
  do not need a dummy props type or parameter. Use `PropsWithChildren` for
  optional `ReactNode` children, directly when children are the only input.
  Declare required or narrower children types explicitly.
- Put reusable UI pieces in `src/shared/ui`.
- Keep route-level screens in their owning `src/features/<feature>` directory.
- Keep feature-specific forms beside the owning feature.
- Do not define React components inside another component render body.

```tsx
type UserCardProps = {
  name: string;
};

export const UserCard = ({ name }: UserCardProps) => <div>{name}</div>;
```

## State and hooks

- Reusable components receive data through props.
- Page/domain components may read app state through hooks.
- Move state down when only a small part of the tree needs it.
- In page components, place translation and form hooks first, then state
  alphabetically by variable name, other base hooks alphabetically by hook
  name, object-destructuring declarations, and other derived constants.
  Dependencies take precedence over alphabetical ordering. Use blank lines
  between responsibilities, following [semantic whitespace](code-quality.md#semantic-whitespace).
- Place `useMemo` declarations after state, context, and other base values but
  before event handlers and helper functions. If a memo depends on a locally
  declared function, place it immediately after that dependency. Do not place
  memo declarations between otherwise related handlers.
- Inside a component, declare event handlers and helper functions before its
  `useEffect` calls. Keep effects together after those functions and before
  early returns or JSX, while ensuring hooks remain unconditional.
- Derive values inline instead of syncing derived state with `useEffect`.
- Avoid `useMemo` and `useCallback` unless they solve a real dependency or performance problem.

## Request lifecycle

For admin reads, cancellation, stale-result guards, timeouts and session-bound
refresh/logout, follow [request reliability](../../docs/authentication.md).
Use direct async/await and local request state in the owning page or provider,
with the existing `useAbortController` and `useLock` helpers; do not introduce
a generic read-hook/cache framework. Preserve request identity
through retries; a new login must not inherit an old mutation or logout completion.

## Forms

- Give every `Form` a descriptive kebab-case `name`, unique among simultaneously
  mounted forms, including hidden drawers. Preserve generated label/input/help
  associations; `Form.Item.name` remains the submitted data path.
- Keep permission-controlled drawers mounted and derive `open` internally from
  their own action hash and canonical operation permission. Gate detail reads
  and submission too. Handle denied actions and missing IDs in the existing
  effect through `useGoBack`; ignore sibling drawer hashes.
- Use the existing synchronous/ref submission lock as well as submitting state.
  Cancel abandoned reads and reject late results before updating the form.
- Type Ant Design submit handlers as `FormProps<Values>["onFinish"]`.
- Put the asynchronous submit logic directly in that handler. Do not add a
  `NonNullable` wrapper or a second callback whose only job is to discard the
  handler promise with `void`.
- Keep the same values type on `Form`, `Form.useForm` and `Form.Item`. For a
  dependent-field render, prefer typed `Form.Item<Values>` with `shouldUpdate`
  and destructured `getFieldsValue()` over an untyped value read plus a cast.
  Request all/unregistered fields only when the form contract actually needs them.
- Clear dependent values in the owning `onValuesChange` handler when their parent
  changes, before applying filters or submitting. Re-key/cancel an options read
  when its parent changes so stale options cannot re-enable an invalid selection.
  Existing field access inside validation rules remains appropriate.

## Independent resources and read-only screens

- Give independent list/lookup resources their own loading, error and retry state
  in their owning component. One failed optional lookup should not
  erase a usable list or unrelated options. Requests may run concurrently; use
  an aggregate failure only when the screen genuinely requires the complete set.
- Preserve cancellation and request-generation guards when parameter or session
  changes invalidate a read. Do not replace them with unguarded async effects.
- A view-only requirement must not gain placeholder CRUD or unsupported write
  handlers. Mounted drawers must enforce read-only permissions internally.
  Retain only actions supported by
  the current contract/permissions; the API remains authoritative.

## Rendering patterns

- Use `condition && <Content />` when `condition` is typed as `boolean`. Use a
  ternary with `null` for numbers, strings, and other truthy/falsy values so
  values such as `0` or an empty string cannot leak into rendered output. Do
  not use patterns such as `items.length && ...` because they can render `0`.
- Use `key` to intentionally reset component state when switching between similar forms or records.
- Avoid spreading large domain objects into components; pass only the props the component needs.
- Use `Map` or object lookups for repeated render-path lookups instead of repeated `Array.find` calls.

## Ant Design tables

- In table column renderers, do not consume the first `value` argument derived
  from `dataIndex`. Ignore it and destructure the required field from the row
  record instead. This keeps the rendered value explicit and consistently
  tied to the typed record.
- Use `dataIndex` for plain display; add `render` only for custom output.
- Use the product's intended empty-value fallback when reading the record. For
  text cells that should treat both `null` and an empty string as missing, use
  `|| "-"`.
- Add server sorting only when the owning HTTP query contract and evidence
  support that field. A displayed column does not imply a sortable API field;
  do not invent sort parameters or present sorting one loaded page as global
  sorting. Preserve the existing filter/pagination behavior unless it changes
  within the requested scope.

```tsx
// Prefer
{
  dataIndex: "mobile",
  render: (_, { mobile }) => mobile || "-",
}

// Avoid
{
  dataIndex: "mobile",
  render: (value: string | null) => value ?? "-",
}
```

## Translations

All user-visible text should go through `react-i18next`.

- Reuse existing root keys for UI meanings shared across admin features, for
  example `t("login")`. Add new shared labels to all ten languages in
  the root of `src/shared/i18n/locales/<code>.ts`, removing superseded keys.
- Add admin-only copy to the same `src/shared/i18n/locales/<code>.ts` for every
  registered language; do not duplicate existing strings or keep old aliases.
- Consume translations through the admin's existing i18next adapter and `useTranslation`;
  keep one code-named file per language without split common/admin files. All ten catalogs must be complete; runtime
  fallback is only emergency behavior and cannot satisfy the completeness gate.
- Keep locale keys alphabetized.
- Use i18next pluralization for count-based strings.

## Icons

- Import the specific named icons directly from `lucide-react` at feature and
  layout call sites.
- Set an explicit `size` suited to the control. Use `currentColor` so the icon
  follows Ant Design text, hover, disabled and semantic colors.
- Hide decorative icons with `aria-hidden`; the owning button, link or control
  supplies its translated accessible name.
- Do not copy Material SVG paths, recreate `SvgIcon`, add local icon wrappers,
  or introduce a string/name-based icon registry. Keep Ant Design components,
  theme tokens and feature ownership unchanged.

## Routing

- Define route keys and paths in `src/app/config/routes.ts`.
- Update `src/app/config/routes.ts` when route access metadata changes. Keep access
  decisions in the pure policy functions under `src/app/lib`.
- Check [the publication policy](../../.github/bootstrap-policy.json) before
  assuming an application entry point or App/Routes composition is admitted.
  While `applicationReady` is false, metadata and component tests cannot establish
  a runnable application. Activation requires the admitted composition and genuine
  build, application browser and reviewed visual checks in the
  [canonical full gate](../validation.json).
