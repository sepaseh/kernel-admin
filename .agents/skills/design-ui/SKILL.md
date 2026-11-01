---
name: design-ui
description: Design or refine published Kernel Admin components and stories with the existing Ant Design stack, including concepts and authorized design handoffs.
---

# Design UI

Read [AGENTS](../../../AGENTS.md), [DESIGN](../../../DESIGN.md) and the closest source
recipe. Follow canonical styling, React, localization and Storybook guidance rather
than copying product rules into another design guide.

1. Identify the requested deliverable: concept/asset/design handoff, component or
   story code in this checkout, or an explicitly authorized hosted prototype.
   Select only available tools and read their relevant skill before use. Keep
   source upload/publication within existing user authorization and clarify only
   material missing decisions.
2. Inspect actual components, token/asset owners and affected HTTP types. Reuse
   Ant Design, antd-style, React Router, Axios and named `FC<Props>` components
   with named props types and type-only imports. Preserve API-owned language, direction,
   calendar and permissions; preview controls are synthetic fixtures.
3. Implement the authorized scope with translated labels, request/session guards,
   permission boundaries, keyboard behavior and responsive/theme states. Respect
   the admitted capability in [the publication policy](../../../.github/bootstrap-policy.json).
   While `applicationReady` is false, component/story implementation does not
   establish an application entry point, route composition or production deployment.
4. Select actual checks from [the manifest](../../validation.json), following
   [validation](../../../docs/validation.md) and
   [validate-change](../validate-change/SKILL.md). Use isolated Storybook browser
   interaction/accessibility evidence for its registered cases. Application E2E
   and visual comparison require admitted owners, genuine current-revision runs
   and human-reviewed baselines; a component pass or historical image cannot supply
   that evidence. Guidance-only work uses the focused guidance profile during iteration;
   an authorized commit/push/PR handoff still requires the complete full gate.
5. Report concrete source/artifact locations, actual checks, visual observations
   and remaining limits. Distinguish a design artifact, component implementation
   and verified hosting. Optional adapters cannot prove automatic host loading.
