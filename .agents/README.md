# Assistant guidance

Start with [root instructions](../AGENTS.md), [source navigation](../docs/source-navigation.md) and the rules indexed in [settings](settings.json). The application-verification phase admits standalone startup, composed routes and the complete application gate. Source admission does not establish successful verification, human visual approval, API-provider compatibility or deployment.

Change only authorized files and preserve unpublished local work. Existing user
authorization and preferences in the current conversation remain valid; do not
ask again for an action already authorized. Never read real environments,
credentials or operator state to answer a source question.

The [validation manifest](validation.json) owns commands and profiles. The manifest separates the seventeen blocking `full` checks from complete browser/visual verification and the temporary advisory performance profile. Local and ordinary PR validation use Chromium. Scheduled and manually requested pre-release verification replace that browser run with the complete four-project matrix, then compare the six approved images once. Each suite runs once per tested source tree; Sonar consumes its verified measured reports. This source verification does not authorize an operational release or deployment. During iteration, `npm run validate -- guidance` is a focused aid; it does not replace exact-source blocking validation.

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

Read [deployment preparation](../docs/deployment.md), [performance policy](../docs/performance.md) and [visual provenance](../docs/visual-regression.md). Pure helper cases join existing measured unit/governance commands. The manifest defines local/PR, complete compatibility and performance responsibilities; policy prose must not recreate a second command inventory.

The exact public example exceptions are `.env.example`, `deploy/docker/.env.example` and `deploy/native/hosts.env.example`, only as reviewed synthetic declared sources. Never use an existing local environment or private operator version as an example. Rendering, packaging, health and smoke CLIs may have filesystem/resource/network effects when called; imports and synthetic fixtures do not authorize real execution. The application gate owns real build, synthetic browser, visual and Lighthouse checks; external provider, Docker and deployment operation remain separate. Historical image metadata does not establish a current approved baseline.

Visual/Lighthouse runners and build metadata stamping remain import-safe. Injected lifecycle/provenance tests do not start the application, Chrome or an API. The admitted application commands separately execute owned synthetic previews and browsers; preserve matching runtime provenance, actual human image approval and the unchanged CI update prohibition. Provider, Docker, staging and deployment operation require separate authorization and evidence.
