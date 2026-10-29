# Styling

Use Ant Design and antd-style with the source recipes in
[DESIGN](../../DESIGN.md) and [UI foundation](../../docs/ui-foundation.md).

## Theme architecture

The current theme builder is `src/shared/config/theme.ts`. Reuse Ant Design
semantic tokens, algorithms and contrast correction; appearance types own Theme
and all seven palette fields. `AntdProvider` follows validated API language and
direction metadata. Only theme and compact mode are browser preferences.

Prefer Ant Design component props before custom styles. Keep inline `style` or
Ant Design `styles` for local layout, and shared global styling in
`src/assets/styles/index.css`. Read [the publication policy](../../.github/bootstrap-policy.json)
for admitted entry/build sources and `applicationReady`, and [the manifest](../validation.json)
for required checks. While readiness is false, a component change cannot establish
application activation. Introducing an entry point requires its genuine application checks.

Keep table delete triggers visually neutral; apply danger treatment to the
confirmation button. Preserve translated accessible names, visible focus,
reduced-motion behavior and narrow/desktop layouts. Use the isolated Storybook
suite for affected browser behavior without claiming production visual evidence.

## Style object readability

Keep style properties alphabetical when order has no semantic effect. Do not mix
a CSS shorthand and its longhand in one object, or reorder spreads/computed
properties in a way that changes behavior. Root ESLint currently catches duplicate
keys but does not publish the future `local/style-props-alphabetical-order` or
`local/style-props-no-shorthand-conflicts` rules. Review these conventions directly;
do not claim an unavailable fixer enforces them.
