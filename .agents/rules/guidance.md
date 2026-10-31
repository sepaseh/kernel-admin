# Repository guidance and evidence

Read this rule when changing instructions, navigation, validation policy, ADRs or
comprehension evaluation. Keep instructions assistant-neutral. Optional host tools,
entry points and hooks are not runtime dependencies or evidence of automatic loading.

## Canonical sources

- Runtime ownership and behavior: current source, feature HTTP DTOs, synthetic consumer tests and executable boundaries. Backend routes, authentication, database, storage and API-owned wire evidence remain in the independent API repository.
- Published scope: `.github/bootstrap-policy.json`. Read its actual phase and `applicationReady` flag. With readiness false, modules, Storybook and preparatory tooling do not establish application initialization, full E2E, current image approval or deployment. With readiness true, source admission still needs actual applicable checks and does not authorize deployment.
- Validation commands/profiles: `.agents/validation.json`. Settings and documentation are links or checked projections, never a second command inventory.
- Task ownership: `.agents/navigation.json` and [source navigation](../../docs/source-navigation.md); inspect actual source, contracts and tests.
- Decisions: [ADRs](../../docs/adr/README.md); explain consequences and supersession.
- Evaluation: `.agents/evaluation/cases.json`, its run template and [comprehension evaluation](../../docs/comprehension-evaluation.md).

Correct active explanations that conflict with verified source. Preserve dated
research and historical evidence as history, not current runtime structure or a
fresh executed result. Do not claim a proposed tool or configured workflow ran.

## Progressive reading and verification

Root/scoped AGENTS files link canonical English rules. Active `.agents`, `.claude`
instructions and evaluation prompts are English only; do not add Persian assistant
companions or duplicate them under docs. Maintain complete English/Persian human
documentation and reciprocal links. Existing user authorization and preferences
in the conversation remain valid throughout the task.

Keep navigation relative to the repository root and maintained Markdown links
relative to each document. Link only published paths; describe future surfaces as
plain code references. Prefer current symbols/paths over fragile line numbers in
living navigation, and verified lines in actual review evidence.

The guidance checker validates safe paths, links, indexes and command projection. Guidance/safety regressions remain inside measured governance coverage. Settings project the current blocking `full` plan; the manifest separately declares any admitted complete compatibility, hosted image or advisory performance roles. Optional Node/Bash hooks require compatible hosts and never replace validation.

Static checks cannot prove assistant discovery, semantic completeness, aesthetic
quality or improved model performance. Record host-reported loaded-file evidence
when available; otherwise mark discovery unknown. Evaluate read-only synthetic
cases without exposing oracle answers to a comprehension subject.

## Change acceptance and evidence

Use [change handoff](../../docs/change-workflow.md) to distinguish requested behavior,
proposals and provider-dependent work. Link observable acceptance scenarios to
canonical checks and record first failures, reproduction, actual results and
unavailable evidence. A failed required check remains a blocker; a documented
exception or provider false positive does not silently waive it.

Use synthetic disposable fixtures. Never read real environments, credentials,
ignored databases or object stores for comprehension or test work. HTTP changes
need compatibility review with the API owner; unrelated catalogs and source copies
remain independently owned. Record verification date, source revision and scope.

## Public preparation sources

The declared inventory includes finite deployment/release helpers, pure quality policies, synthetic tests, complete human EN/FA procedures and historical visual assets. Classify them by actual capability: a helper source or fixture is not an executed deployment, real build, browser audit or current image approval. Keep absent future paths as plain code references rather than active Markdown links.

Only explicitly declared, reviewed synthetic public examples at `.env.example`, `deploy/docker/.env.example` and `deploy/native/hosts.env.example` qualify for source admission. Do not generalize this to another environment filename or read a local private homonym. Real credentials, certificates and operator state remain outside guidance/source verification.

Preserve the declared current core profile, measured suite owners, product assertions and coverage thresholds. Commands and profile roles are admitted by the manifest, not prose. Read [deployment](../../docs/deployment.md), [test reliability](../../docs/test-reliability.md) and [visual history](../../docs/visual-regression.md); preserve source revisions and evidence limits.

The approved workflow model reuses reports only with verified tested-source and original-producer identity. Scheduled/manual requests and synthetic future-phase fixtures never change the readiness flag or activate unpublished application behavior.
