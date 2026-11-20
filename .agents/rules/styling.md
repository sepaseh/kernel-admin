# Styling

Use Ant Design and antd-style. Start with the closest component and the
[design guide](../../DESIGN.md).

## Theme architecture

`AntdProvider` owns UI theme configuration. Reuse Ant Design semantic tokens
and algorithms. The appearance contract defines `Theme` and the seven palette
fields. Follow the localization rules for metadata and browser preferences.
[Ant Design provider](../../src/app/providers/antd/Antd.tsx) · [Appearance contract](../../src/shared/contracts/appearance.ts) · [Settings metadata](localization.md#apply-settings-metadata)

Prefer Ant Design component props before custom styles. Keep inline `style` or
Ant Design `styles` for local layout and use logical spacing that works in both
text directions. Keep global styling in `src/index.css`, `src/GlobalStyle.tsx`
and `src/assets/styles`.

## Interaction styling

Keep table delete triggers visually neutral and apply danger treatment to the
confirmation button. Preserve translated accessible names, visible focus,
reduced-motion behavior and narrow and desktop layouts. Follow the
[design review steps](../../DESIGN.md#review-the-interaction) for verification.

## Icons

Use named `lucide-react` imports directly at feature and layout call sites.
Give icons an explicit `size` and `currentColor` so they follow Ant Design's
text, hover, disabled and semantic colors. Mark decorative icons `aria-hidden`
and give their owning controls translated accessible names. Reuse these imports
and Ant Design props. Keep copied Material SVG paths, `SvgIcon`, local icon
wrappers and string-based registries out of the UI.

## Style object readability

Use the [ordering rules](ordering.md) for style properties. Preserve the order
of spreads and computed keys when it affects the result. Use either a CSS
shorthand or its longhand properties in a given style object. ESLint checks duplicate keys.
Review property ordering and shorthand conflicts directly in changed styles.
