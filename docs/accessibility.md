# Accessibility scope and checks

[English](accessibility.md) · [فارسی](accessibility.fa.md)

Read the admitted inventory and `applicationReady` in [the publication policy](../.github/bootstrap-policy.json), and select actual checks from [the manifest](../.agents/validation.json). While readiness is false, unit/component and isolated Storybook evidence cannot establish complete application journeys. Even a runnable application and successful automated audits do not establish a manual screen-reader review or deployed accessibility.

Use Ant Design tokens and the shared theme for readable text, controls, status marks and visible focus in light/dark and LTR/RTL views. Decorative Lucide icons use `aria-hidden`; the owning control needs a translated accessible name. Keep genuine complete local catalogs and server-owned language/direction metadata.

For an affected form or dialog, verify keyboard submission, first invalid-field focus, labels and visible errors, focus containment/Escape/trigger restoration, and destructive confirmation behavior where implemented. Use accessible roles and labels with synthetic fixtures rather than implementation-only assertions. Storybook uses complete API mocks and treats accessibility violations as failures; do not disable audits to hide a defect.

Application accessibility evidence requires admitted route/browser owners and genuine runs against the built application with synthetic API fixtures. Record the source revision, exercised states, violations and unexecuted manual work. The retained [Windows images](visual-regression.md) are dated provenance, not a fresh visual or accessibility approval. A screenshot cannot replace keyboard, contrast or assistive-technology testing.

See [component coverage](component-coverage.md), [Storybook verification](storybook-verification.md) and [testing](testing.md).
