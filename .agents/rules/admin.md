# Admin conventions

Start with the [application architecture](../../docs/architecture.md) and
[development guide](../../docs/development.md) to locate the screen, service or
shared component that owns the change. Read that owner and its tests.

- For imports and source boundaries, use the [import policy](imports.md).
- For components, routes and forms, use the [React rules](react.md),
  [TypeScript rules](typescript.md) and [ordering rules](ordering.md).
- For HTTP requests and session changes, use [request lifecycles](../../docs/authentication.md).
- For UI changes, use [design](../../DESIGN.md), [styling](styling.md) and
  [localization](localization.md).
- For regressions and evidence, use the [testing rules](testing.md) and
  [validation guide](../../docs/validation.md).
