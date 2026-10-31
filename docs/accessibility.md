# Accessibility scope and checks

[English](accessibility.md) · [فارسی](accessibility.fa.md)

Use the [publication policy](../.github/bootstrap-policy.json) to establish admitted application capability and the [manifest](../.agents/validation.json) to select its required checks. Unit/component cases and the isolated Storybook Chromium suite remain required. The application-verification phase adds real route/browser fixtures; a successful synthetic journey does not establish deployed accessibility or a manual screen-reader review.

Use Ant Design tokens and the shared theme for readable text, controls, status marks and visible focus in light/dark and LTR/RTL views. Decorative Lucide icons use `aria-hidden`; the owning control needs a translated accessible name. Keep genuine complete local catalogs and server-owned language/direction metadata.

For an affected form or dialog, verify keyboard submission, first invalid-field focus, labels and visible errors, focus containment/Escape/trigger restoration, and destructive confirmation behavior where implemented. Use accessible roles and labels with synthetic fixtures rather than implementation-only assertions. Storybook uses complete API mocks and treats accessibility violations as failures; do not disable audits to hide a defect.

The application accessibility suite exercises authentication, tables and drawers with English/Persian settings in light/dark themes. Ordinary PRs execute Chromium; scheduled and manually requested pre-release checks run every declared browser project once. The login, registration, recovery and invalid-login states are independent bounded tests, preserving all Axe analyses, contrast, keyboard, focus and error-association assertions. Complete synthetic HTTP and unexpected-request guards remain mandatory; no automatic retry conceals a failure.

User drawers initially focus the first field only if the form has not already received focus during opening. Closing resets this guard for the next opening.

The user and role lists place their unchanged Ant Design tables inside translated, named native `<section>` horizontal scroll regions. The region itself is a keyboard stop so read-only tables remain scrollable without row actions, following [W3C scroll focus guidance](https://www.w3.org/WAI/standards-guidelines/act/rules/0ssw9k/) and the [scroll-container exception documented by jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/no-noninteractive-tabindex.md). Browser cases verify actual arrow-key scrolling when the table overflows. Shared form drawers and destructive confirmations intercept Tab at their first/last available controls through public Ant Design event/render props; Ant Design retains opening, Escape and trigger restoration. Hidden, disabled and inert controls do not become endpoints. Invalid-form cases await the form's actual error focus before entering corrected values.

The retained [Windows images](visual-regression.md) are dated provenance, not current visual or accessibility approval. New screenshots require actual human review. A screenshot cannot replace keyboard, contrast or assistive-technology testing; assistive-technology and deployed checks need their own observed evidence.

See [component coverage](component-coverage.md), [Storybook verification](storybook-verification.md) and [testing](testing.md).
