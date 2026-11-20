---
name: design-ui
description: Design or refine Kernel Admin screens, components and stories with the existing Ant Design stack, including concepts and authorized design handoffs.
---

# Design UI

Read [AGENTS.md](../../../AGENTS.md), the [design system](../../../DESIGN.md)
and the owner of the affected interface in the current checkout. Identify the
requested deliverable and available tools. Follow the
[remote action rules](../../rules/safety.md#external-systems) for uploads and
publication.

1. Confirm whether the request is for a concept, asset, design handoff, screen,
   component, story or explicitly authorized hosted prototype. Read the relevant
   skill before using a design tool. Clarify missing decisions that materially
   affect the scope.
2. Inspect existing components, tokens, assets and affected HTTP types. For a
   routed screen, trace its entry and layout before changing the feature.
   [Routes](../../../src/app/Routes.tsx) · [Import rules](../../rules/imports.md)
3. Implement the authorized scope against the admitted source. Use existing
   owners for request lifecycles, permission checks, translated labels, keyboard
   interactions and visual states.
   [Publication policy](../../../.github/bootstrap-policy.json) · [React](../../rules/react.md) · [Styling](../../rules/styling.md) · [Localization](../../rules/localization.md)
4. Review the delivered artifact for concept or handoff work. For an implemented
   interaction, review its story or routed screen. Use applicable approved
   images and follow the validation workflow for the scope.
   [Design review](../../../DESIGN.md#review-the-interaction) · [Validation workflow](../validate-change/SKILL.md) · [Appearance review](../../../docs/testing.md#review-appearance)

Report the deliverable, reused or changed components and tokens, actual checks,
visual observations and evidence limits.
