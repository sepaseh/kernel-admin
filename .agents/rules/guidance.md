# Guidance and documentation

Use the [assistant guidance index](../README.md) to locate the relevant rule,
source and tests. The [publication policy](../../.github/bootstrap-policy.json)
defines admitted paths. Plain paths can identify planned owners, so verify the
current source before applying its conventions or documenting it as available.

## Maintain documentation

Keep assistant instructions and maintained documentation in English, current and
organized by reader task. Update the owning guide alongside behavior,
configuration, test or workflow changes. Verify changed claims against the
owning source and nearby tests.

Procedures state prerequisites, actions, expected results and relevant recovery.
References define contracts. Explanations describe ownership and reasoning.

Do not add dated QA reports, archives, ADRs, translated companion guides
or bilingual navigation. Application localization remains a separate concern.

Use the existing [architecture](../../docs/architecture.md), [development guide](../../docs/development.md)
and task map to select the owner. Keep PR numbers, commit hashes, CI-run results,
past owner decisions, decision logs and investigation evidence in the current
chat or authorized PR materials.

Organize user-facing navigation around installation, capabilities, source work
and deployment using existing guides. Keep the existing taxonomy, folders and
indexes when aligning that navigation.

## Maintain indexes and optional integrations

Use repository-relative machine paths and document-relative Markdown links to
current files. Register only published owners, tests, rules, skills and actual
check IDs. Use admitted public source and synthetic fixtures for examples.
Follow the [fixture safety rules](safety.md#secrets-and-local-state).

The [validation manifest](../validation.json) owns commands and profiles.
Settings project that inventory. Refer to the manifest for the full gate and
keep prose free of a separate gate inventory or check count.

Document optional adapters and hooks according to their actual host integration
and [safety limits](safety.md#optional-safety-hooks).

## Record evidence

Report execution outcomes and evidence limits in the current task or terminal.
Do not commit execution reports. Create a local report only when explicitly
requested, under ignored `test-results/`. Required coverage stays in its
configured location. Use the [working-checkout rule](branches.md#working-checkout)
for scratch exports and recovery files.

Static guidance checks verify published paths, local Markdown links and section
anchors, indexes and command consistency. Support claims about instruction loading, application behavior, provider results,
portability or performance with evidence from the relevant execution.

Record actual host-reported loading where available and otherwise mark discovery
unknown. Follow the [read-only comprehension evaluation](../../docs/comprehension-evaluation.md)
only when requested.

## Verify localized and visual material

Keep [catalog and calendar contracts](localization.md) and
[visual-baseline provenance](../../docs/testing.md#compare-and-approve-images)
with their technical owners. Clearly identified localized product strings, date
examples and synthetic UI fixtures may retain their language. Keep surrounding
prose in English.

The guidance check rejects Persian Markdown companion filenames recursively and
non-Latin prose in admitted Markdown. Put localized product examples in inline
code or fenced or indented code blocks. Review Latin-script prose for English,
which requires manual judgment.

Follow the [documentation workflow](../../CONTRIBUTING.md#documentation).
