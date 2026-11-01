# Guidance and documentation

Use [AGENTS](../../AGENTS.md), the [settings index](../settings.json) and [source navigation](../../docs/source-navigation.md) for progressive reading. Read the owner source and tests; index entries and static links do not prove behavior or successful execution.

Keep documentation English, current and organized by reader task. Follow the [documentation workflow](../../CONTRIBUTING.md#documentation) and use the [documentation map](../../docs/README.md) to select its existing owner. Procedures state prerequisites, actions, expected results and relevant recovery; reference sections define contracts; explanations describe ownership and reasoning. Verify changed claims against the actual source and closest tests. Update the owning guide alongside behavior, configuration, test or workflow changes. Do not add routine dated QA reports, archives, architecture-decision records, translated companions or bilingual navigation. Preserve all ten UI catalogs, Persian calendar data, runtime language metadata and dated UI evidence. Clearly identified localized product strings, date examples and synthetic UI fixtures may retain their language; surrounding documentation prose and assistant instructions stay English.

The guidance check rejects Persian Markdown companion filenames recursively and non-Latin prose in Markdown admitted by the publication inventory. Put localized product examples in inline code or fenced/indented code blocks. This static check cannot classify the language of Latin-script sentences; review their prose for English. Unadmitted files, generated output and private runtime state are never read as documentation.

Use repository-relative machine paths and document-relative Markdown links. Link maintained current files, not future or deleted paths. Keep source ownership and verification commands in their canonical owners rather than duplicating check lists or fixed counts.

The [manifest](../validation.json) owns profiles; settings project it. Guidance and portable hook tests remain within their declared suites. Optional host adapters/hooks need actual integration and do not grant authorization, register themselves automatically or establish comprehension.

For a requested [read-only evaluation](../../docs/comprehension-evaluation.md), keep prompts separate from oracle answers and distinguish host-reported loading from manual reads. Never inspect secrets or owner data. Report actual results and limitations in the handoff rather than inventing capability claims.
