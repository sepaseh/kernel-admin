# Assistant guidance

Start with [root instructions](../AGENTS.md), [source navigation](../docs/source-navigation.md)
and the rules indexed in [settings](settings.json). The current
`assistant-guidance` phase retains `applicationReady: false`: it publishes
instructions and verification tooling beside the existing isolated Storybook
scope, without an application entry point or production deployment.

Change only authorized files and preserve unpublished local work. Existing user
authorization and preferences in the current conversation remain valid; do not
ask again for an action already authorized. Never read real environments,
credentials or operator state to answer a source question.

The [validation manifest](validation.json) owns commands and profiles. The full
profile has twelve required checks: the existing eleven phase checks plus
`check:guidance`. Guidance regressions join the existing governance suite and its
measured LCOV; they are not a second required full-suite invocation. During
iteration, `npm run validate -- guidance` runs the required guidance check and
advisory `test:guidance` profile entry. Focused checks do not replace
`npm run validate -- full` on the exact final snapshot before an authorized
commit, push or PR handoff.

Active assistant instructions and evaluation prompts are English only. Maintain
English/Persian companions for human documentation. Dated evidence remains
history rather than a current executed result.

Interface tasks start with [DESIGN](../DESIGN.md) and
[design-ui](skills/design-ui/SKILL.md). Git and remote tasks start with
[Git workflow](rules/git.md). `CLAUDE.md` and the `.claude` design skill are
optional host entry points to the same local instructions. Settings and static
checks do not register these files with every assistant or prove automatic loading.

Optional Node/Bash hooks require a compatible host and explicit integration.
Portable Node safety regressions run independently of optional Bash cases; Bash
wrappers require Bash and Node. The post-edit formatter parses input with Node
and fixes only the selected file through the project-local ESLint CLI.
Hooks are neither runtime dependencies nor substitutes for the complete gate.

The optional safety policy models literal Bash/sh/dash/zsh commands within its
65,536-character and four-level nesting limits. Inline Git `-c` accepts only
`color.ui` with literal `true`, `false`, `auto`, `always` or `never`; other keys,
`GIT_CONFIG`/`GIT_CONFIG_*` setters through `export`, `declare`, `typeset`,
`readonly` or `local`, plus `xargs` and `find` execution actions, are blocked. Arbitrary program behavior and host authorization remain outside this
convenience guard.
