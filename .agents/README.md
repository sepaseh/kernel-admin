# Assistant guidance

Start with [AGENTS](../AGENTS.md), the canonical rules in [settings](settings.json) and the current [task map](navigation.json). Read source and nearby tests before changing an owner, and preserve unrelated work.

[The publication policy](../.github/bootstrap-policy.json) owns exact source admission and readiness. Application conventions and plain code paths in guidance describe requirements for their owners when admitted. They do not establish application availability, successful execution or automatic host instruction loading.

The [validation manifest](validation.json) owns commands and profiles. Start focused, then run its complete `full` profile on an exact, isolated verification-only export before an authorized commit, push or handoff. Follow [validation](../docs/validation.md). Optional hooks and adapters do not install themselves, grant permissions or replace required checks.

Git and remote work starts with [Git workflow](rules/git.md). Use [development](../docs/development.md) for the current root toolchain and contribution process. Interface work follows [DESIGN](../DESIGN.md) and [design-ui](skills/design-ui/SKILL.md) only for admitted components or an explicitly requested concept. React, Ant Design, React Router, Axios, complete local catalogs and API-owned language metadata remain application constraints.

Current human documentation and active assistant instructions are English. Use [the documentation map](../docs/README.md) and update the existing task owner. Keep investigations and actual results in the chat or authorized PR materials, without adding maintained decision logs or historical execution reports.

Never read real environment files, credentials, keys, certificates, databases, uploads or browser state as test fixtures. Preserve private local settings and operator state unread. Only reviewed synthetic public examples may be fixtures when explicitly admitted by the publication policy.

Existing authorization persists within its scope. Source preparation does not authorize publication, provider review, deployment or real operations. The [working-checkout rule](rules/branches.md#working-checkout) requires the existing checkout and keeps disposable validation exports verification-only.
