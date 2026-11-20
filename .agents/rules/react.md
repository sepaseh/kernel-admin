# React

Use these rules for component structure, hooks, forms and routing. Follow the
[import policy](imports.md#source-owners) for source ownership.

## Components

- Keep one exported React component per `.tsx` file when practical.
- Use a named props type on the component parameter and infer the return type.
  Omit the props type and parameter for components without props.
  Use a component-specific name. Avoid `FC` and other component-function types.
  Use `PropsWithChildren` for optional `ReactNode` children, directly when
  children are the only input. Declare required or narrower children types
  explicitly.
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

Keep direct `async`/`await` and request state in the owning page or provider.
Follow the [read lifecycle](../../docs/authentication.md#read-resources),
[mutation guards](../../docs/authentication.md#mutation-guards) and
[session generations](../../docs/authentication.md#session-generations) for
controller ownership, submission locking and stale-result checks.

## Forms

- Give every `Form` a descriptive kebab-case `name`, unique among simultaneously
  mounted forms, including hidden drawers. Preserve generated label/input/help
  associations; `Form.Item.name` remains the submitted data path.
- Keep permission-controlled drawers mounted and derive `open` internally from
  their own action hash and canonical operation permission. Gate detail reads
  and submission too. Use the parent page's `onClose` for canceling and for
  failures to open the form, including denied actions and missing IDs. Ignore
  sibling drawer hashes. The page owns return navigation through `useGoBack`
  and stores each edit target ID in its history entry. On a successful save,
  notify the page through `onFinish` so it can refresh the list and close the drawer.
- If a drawer owns an image upload, unmount the field on close so `ImageUpload`
  can abort the request. Forward its upload signal to the owning file API and
  preserve the guards against late results. [Content drawer](../../src/features/contents/components/content-form/ContentForm.tsx)
- Apply the [request lifecycle](#request-lifecycle) to detail reads and writes.
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

- Follow the [read lifecycle](../../docs/authentication.md#read-resources) for
  independent list and lookup state. Requests may run concurrently. Use an
  aggregate failure only when the screen needs the complete set to operate.
- Show only actions supported by the current contract and permissions. Keep
  view-only screens free of placeholder writes and apply the permission checks
  in [Forms](#forms) to mounted drawers. The API authorizes each operation.

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

Follow the [localization rules](localization.md#maintain-catalogs) for
user-visible text, catalog changes and pluralization.

## Icons

Follow the [styling rules for icons](styling.md#icons) for imports, sizing,
color and accessible names.

## Routing

- Define route keys and paths in `src/app/config/routes.ts`.
- Update `src/app/config/routes.ts` when route access metadata changes. Keep access
  decisions in the pure policy functions under `src/app/lib`.
- Check that the application entry and route composition are admitted. Use the
  application build and Chromium journeys for routed behavior, and follow the
  appearance review workflow for affected images. [Publication policy](../../.github/bootstrap-policy.json) · [Application journeys](../../docs/testing.md#test-application-journeys-and-contracts) · [Appearance review](../../docs/testing.md#review-appearance)
