# Assistant guidance

Start with [root instructions](../AGENTS.md), [source navigation](../docs/source-navigation.md)
and the rules indexed in [settings](settings.json). The application-verification phase admits the standalone application entry and composed routes, its production build and complete genuine application checks. Source admission does not establish actual human visual approval, API-provider compatibility or a deployed service.

Change only authorized files and preserve unpublished local work. Existing user
authorization and preferences in the current conversation remain valid; do not
ask again for an action already authorized. Never read real environments,
credentials or operator state to answer a source question.

The [validation manifest](validation.json) owns commands and profiles. The full profile preserves all inherited checks and includes the genuine application build, browser, visual, consumer-contract and performance checks declared in the manifest. Governance retains measured guidance regressions without duplicate full-suite execution. During
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

Read [deployment preparation](../docs/deployment.md), [performance policy](../docs/performance.md) and [visual provenance](../docs/visual-regression.md). Pure helper cases join existing measured unit/governance commands; The manifest owns the full application gate; operational aliases never authorize real external activity.

The exact public example exceptions are `.env.example`, `deploy/docker/.env.example` and `deploy/native/hosts.env.example`, only as reviewed synthetic declared sources. Never use an existing local environment or private operator version as an example. Rendering, packaging, health and smoke CLIs may have filesystem/resource/network effects when called; imports and synthetic fixtures do not authorize real execution. The application gate owns build, browser, visual and Lighthouse checks; external API-provider, real Docker and deployment operation remain separate. Historical image metadata does not establish a current approved baseline.

Verification runners and the build metadata stamper remain import-safe. Their injected lifecycle/provenance tests join measured suites; importing a module must never start a browser, process, network request or write. Admitted application CLIs separately run owned synthetic previews and browsers. Preserve the complete application manifest, matching-platform visual provenance, human approval and separate authorization for real operator targets.
