# Assistant guidance

Start with [AGENTS](../AGENTS.md) and the rules indexed in [settings](settings.json). Use the existing [architecture](../docs/architecture.md), [development guide](../docs/development.md) and [task map](navigation.json) to locate current owners. Read current source before changing it and preserve unrelated user work.

The [validation manifest](validation.json) owns commands and profiles. Start with a focused check, then run its full profile on the exact isolated proposed source before an authorized commit, push or handoff. Use [validation](../docs/validation.md) and honest current-revision results; optional hooks and host adapters are not substitutes.

Ordinary local and PR verification uses Chromium. The complete profile substitutes the full browser matrix and adds approved-runtime image comparison; numerical metrics are advisory under [code quality](rules/code-quality.md). Preserve these manifest responsibilities and source-bound measured reports when reorganizing checks.

Application CI exposes its actual suites independently. The manifest's CI profiles partition every required check once, and `check` aggregates their results. Reuse the verified build across browser, visual and performance jobs and the measured producer reports for Sonar. Follow [validation](../docs/validation.md) when changing source identity, artifacts or producer attempts.

Interface work starts with [DESIGN](../DESIGN.md) and [design-ui](skills/design-ui/SKILL.md). Git/remote work starts with [Git workflow](rules/git.md). Current human docs and active assistant instructions are English. Keep application translations and API-owned language metadata intact.

Never use real environments, credentials, certificates, databases, uploads or browser state as fixtures. Existing authorization persists within scope; source preparation does not authorize real operations or publication.

Read [deployment](../docs/deployment.md) before invoking helpers that may write files, start resources or contact targets. Only reviewed synthetic public examples at `.env.example`, `deploy/docker/compose.env.example` and `deploy/native/nginx.env.example` are source exceptions; private counterparts remain unread.
