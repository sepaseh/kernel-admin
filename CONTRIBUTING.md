# Contributing

Read [development](docs/development.md), [source navigation](docs/source-navigation.md) and the relevant rules under `.agents/rules`. Keep changes focused and preserve unrelated local work.

## Checks

Use `.nvmrc` and its bundled npm. Start with the smallest relevant check, then run the current canonical `npm run validate -- full` on an isolated export of the exact proposed source before an authorized commit, push or PR handoff. Install locked dependencies and declared browsers first. [Validation](docs/validation.md) owns the procedure; [the manifest](.agents/validation.json) owns commands and required profiles.

Keep synthetic fixtures, honest coverage and existing thresholds. Do not read real environments, credentials, databases or uploads, contact production, suppress findings or skip required checks to obtain a pass. Report failures and unavailable prerequisites plainly.

## Documentation

Maintain documentation in English alongside the change that affects it. Application catalogs retain every supported language. Use the [documentation map](docs/README.md) to find the existing owner; the run, development, verification and deployment guides serve different reader tasks.

1. Identify the reader's goal and read the current source and closest tests. State the page's purpose before implementation details.
2. Write procedures as ordered actions with prerequisites, an explicit shell and working directory, meaningful placeholders and an observable result. Put recovery advice near the step that can fail.
3. Keep option tables and behavioral contracts in reference sections, and explain ownership or tradeoffs separately. Link related material instead of mixing every kind of information into one procedure.
4. Verify commands against `package.json`, options against their implementation and check profiles against the [validation manifest](.agents/validation.json). Use document-relative links to current source and guides. Keep one maintained owner for each contract and command inventory.
5. Use synthetic public examples. Explain writes, service startup or target access before the relevant command, and preserve the authorization boundaries in [deployment](docs/deployment.md). Examples and configuration do not establish that an operation succeeded.
6. Run `npm run validate -- guidance` and check formatting for the edited Markdown. Review the procedure for missing inputs and expected results; link checks alone do not execute its commands. Follow [validation](docs/validation.md) for the full gate before an authorized commit, push or PR handoff.

Use concise descriptive headings, direct verbs and consistent project terms. Update incoming links when moving a section. Keep routine results in the change handoff rather than adding dated QA reports, duplicate checklists or decision logs.

This workflow applies [Diátaxis](https://diataxis.fr/start-here/) to reader needs, [Google's procedure guidance](https://developers.google.com/style/procedures) to actionable steps, and [Docs as Code](https://www.writethedocs.org/guide/docs-as-code/) to review and validation. The repository's source contracts and safety rules remain authoritative.

## Pull requests

Use a focused `codex/<purpose>` branch, a Conventional Commit title and the [PR template](.github/PULL_REQUEST_TEMPLATE.md). Target at most 80 GitHub changed-file entries initially, reserving 20 for review fixes under the hard 100-entry limit. Count additions, deletions, renames and binaries; a rename is one entry. Review the complete base-to-head diff and include only the requested scope.

Commit, push, publish, comment or merge only with authorization covering that action. Publish authorized PRs Ready for review. Keep incomplete work local and preserve user changes. Never force-push protected main or bypass hooks/protection to hide a failure.

Verify current-head CI, the actual scanner and Sonar quality gate, required approval and resolved conversations before an authorized merge. CodeRabbit requests are manual: complete [the review preflight](docs/validation.md#hosted-checks-and-review), respect quota and avoid duplicates. A skipped bot result is not approval.

Include affected documentation in the same reviewable change, following the [documentation workflow](#documentation).
