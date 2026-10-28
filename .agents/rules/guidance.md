# Repository guidance and evidence

Read this rule when changing instructions, navigation, validation policy, ADRs or
comprehension evaluation. Keep instructions assistant-neutral. Optional host tools,
entry points and hooks are not runtime dependencies or evidence of automatic loading.

## Canonical sources

- Runtime ownership and behavior: current source, feature HTTP DTOs, synthetic
  consumer tests and executable boundary policies. Backend routes, authentication,
  database, storage and API-owned wire evidence stay in the separate API repository.
- Published scope: `.github/bootstrap-policy.json`. The current
  `assistant-guidance` phase retains `applicationReady: false`; isolated Storybook
  does not establish application initialization, full E2E, visual approval or deployment.
- Validation commands/profiles: `.agents/validation.json`. Settings and documentation
  are links or checked projections, never separate complete gate definitions.
- Task ownership: `.agents/navigation.json` and
  [source navigation](../../docs/source-navigation.md). Open actual owners,
  contracts and tests rather than trusting the map alone.
- Decisions: [ADRs](../../docs/adr/README.md); explain consequences and supersession.
- Evaluation: `.agents/evaluation/cases.json`, its run template and
  [comprehension evaluation](../../docs/comprehension-evaluation.md).

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

The guidance checker validates safe paths, links, indexes and command projection.
Guidance/safety regressions run inside the existing governance coverage suite. The
focused guidance profile includes an advisory regression command; the required full
profile includes twelve checks without duplicating that suite. Optional Node/Bash
hooks need compatible host support; they cannot replace the complete gate.

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
