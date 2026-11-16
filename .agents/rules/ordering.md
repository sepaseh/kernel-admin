# Ordering

[The publication policy](../../.github/bootstrap-policy.json) defines the currently admitted source. Application conventions below apply when their owners are admitted; plain paths can identify planned owners and do not establish a runnable application or successful execution.

Sort alphabetically wherever order has no semantic meaning.

## Apply to

- Object keys
- Type fields
- Type declarations within `types.ts` files
- Component props
- Named exports in index files
- Translation keys
- Array items when order does not affect behavior

ESLint import sorting is advisory; apply fixes only through an explicit command.

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
