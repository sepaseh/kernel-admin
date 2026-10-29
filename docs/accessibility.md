# Accessibility scope and checks

[English](accessibility.md) · [فارسی](accessibility.fa.md)

The current evidence comes from unit/component tests and the isolated Storybook Chromium suite. The application is not assembled, so these checks do not establish complete route journeys, a manual screen-reader review or deployed accessibility.

Use Ant Design tokens and the shared theme for readable text, controls, status marks and visible focus in light/dark and LTR/RTL views. Decorative Lucide icons use `aria-hidden`; the owning control needs a translated accessible name. Keep genuine complete local catalogs and server-owned language/direction metadata.

For an affected form or dialog, verify keyboard submission, first invalid-field focus, labels and visible errors, focus containment/Escape/trigger restoration, and destructive confirmation behavior where implemented. Use accessible roles and labels with synthetic fixtures rather than implementation-only assertions. Storybook uses complete API mocks and treats accessibility violations as failures; do not disable audits to hide a defect.

Application accessibility specs and real route/browser checks remain future activation work. The retained [Windows images](visual-regression.md) are dated provenance, not a fresh visual or accessibility approval. A screenshot cannot replace keyboard, contrast or assistive-technology testing.

See [component coverage](component-coverage.md), [Storybook verification](storybook-verification.md) and [testing](testing.md).
