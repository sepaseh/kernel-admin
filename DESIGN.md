# Design conventions

Identify the user task, primary action and relevant states before changing the
interface. Start with the feature owner and existing shared controls. Use the
closest component stories and see [Development](docs/development.md) for the
implementation workflow.

## Reuse current owners

| Design concern                                | Existing owner                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Light, dark and compact algorithms and colors | [Ant Design provider](src/app/providers/antd/Antd.tsx) uses the selected API palette.            |
| Typography and local assets                   | [Root styles](src/index.css) load the licensed local Vazirmatn font.                             |
| Reusable controls and feature forms           | [Shared UI](src/shared/ui) provides common controls. Feature forms own their drawers and fields. |
| Route vocabulary and presentation permissions | [Route metadata](src/app/config/routes.ts) and [access helpers](src/app/lib/access.ts)           |

Prefer Ant Design props and semantic tokens. Use antd-style for component styles and logical spacing for both text directions. Give Lucide icons an explicit size and `currentColor`. Mark decorative icons with `aria-hidden` and give controls translated accessible names. [Styling rules](.agents/rules/styling.md) · [React rules](.agents/rules/react.md)

Use Ant Design `Drawer` directly in feature editors. Give each `Form` a descriptive name and route its footer submit button through the same validation as keyboard submission. Keep delete triggers neutral and apply danger styling to the confirmation action. [User form](src/features/users/components/user-form/UserForm.tsx) · [Localization](docs/localization.md)

## Review the interaction

Use the rendered interface to verify changed interactions and report the checks
that actually ran.

1. Identify the user task, required permission and expected result. Find an existing control or story to use as the starting point.
2. Exercise the populated screen and the relevant states below. In the component story, change language and direction independently, then check theme and density with realistic content lengths. [Storybook fixtures](docs/localization.md#fixtures-and-checks)
3. Verify the changed interaction with component or application browser tests. For a drawer or destructive confirmation, open it using the keyboard, check its controls and dismiss it with Escape. Check the resulting focus and whether cancellation leaves the data untouched. [Application accessibility cases](e2e/accessibility.spec.ts)

| State or condition                    | Expected behavior                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Loading, empty and initial failure    | A named loading status, useful empty feedback or a clear retry path.                                             |
| Refresh failure after success         | Previously accepted data remains usable with separate refresh feedback.                                          |
| Invalid or submitting form            | Keyboard and button submission share validation; first-error focus and submitting feedback are preserved.        |
| Drawer or confirmation                | Focus stays contained, Escape follows the supported close behavior and focus returns to the trigger.             |
| Read-only or denied action            | Presentation reflects the current account's permissions without suggesting that it authorizes the API operation. |
| Narrow layout, RTL/LTR or long labels | Controls remain operable, content remains readable and spacing uses logical directions.                          |
| Light/dark/compact or reduced motion  | Semantic contrast and focus indicators remain visible, with the existing motion preference respected.            |

Use Storybook for isolated component interactions and application browser tests for composed flows. Review actual palette contrast and assistive-technology behavior separately from automated accessibility results. Follow the baseline review workflow when changing an approved image. [Testing](docs/testing.md) · [Validation](docs/validation.md)

The [design skill](.agents/skills/design-ui/SKILL.md) describes optional concept/asset/tool handoffs. Use only available tools and authorized uploads/publication. Keep source, assets and licenses intact; a hosted artifact does not change this repository by itself.
