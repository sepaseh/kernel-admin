# Ordering

Sort alphabetically wherever order has no semantic meaning. Preserve meaningful
execution and validation order.

## Apply to

- Object keys, including style properties
- Type fields
- Type declarations within `types.ts` files
- Component props
- Named exports in index files
- Translation keys
- Array items when order does not affect behavior

Follow the [autofix workflow](code-quality.md#autofix-workflow). Use the
[styling rules](styling.md#style-object-readability) for shorthand and the
[React rules](react.md#state-and-hooks) for hook placement.

## Example

```ts
// Prefer
type User = {
  email: string;
  id: string;
  name: string;
};

// Avoid
type User = {
  id: string;
  name: string;
  email: string;
};
```
