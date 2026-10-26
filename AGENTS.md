# Kernel Admin catalog instructions

Read [README](README.md), [Contributing](CONTRIBUTING.md), the current
[publication inventory](.github/bootstrap-policy.json) and the canonical
[validation manifest](.agents/validation.json) before changes.

This standalone npm project's catalogs phase publishes framework-free admin
primitives and ten complete flat translation catalogs, their local code registry
and pure Persian calendar data. Keep these modules independent of another checkout,
backend SDKs and UI initialization. The API owns authentication execution,
database access and storage.

Read [localization](docs/localization.md) before changing catalogs. Keep one
code-named catalog per registered language, root string messages, complete keys
and i18next interpolation parity; do not add common objects or compatibility aliases.
Leaf catalog files, locales.ts and dayjs/fa.ts may import only fully erased local
types. Do not load fallback data through runtime imports/re-exports, dynamic imports
or require. Only catalogs.ts may load the canonical local catalog objects at runtime.
The code list selects catalogs only. The API owns active language, direction,
calendar and names; future runtime adapters must consume that metadata without
persisting a visitor language choice or inferring direction/calendar from a code.
Runtime i18next/React/date adapters are not published in this phase.

The catalogs phase has `applicationReady: false`. Do not claim a working panel,
production build, browser journey or visual check from these unit tests. A
runnable phase must introduce the React/Vite application and its complete
validation, preserving Ant Design, antd-style, React Router, Axios and directly
typed component parameters without FC aliases.

Required checks follow the published phase: the catalogs phase requires `check`,
`SonarQube Cloud analysis`, `SonarCloud Code Analysis` and `CodeRabbit`. Before
any runnable panel merges, introduce real build/e2e/visual jobs, expand the full
canonical gate, observe those jobs pass and add them to required checks. Do not
substitute placeholder jobs or skipped checks for application evidence.

Run `npm run validate -- full` on the exact proposed snapshot before an
authorized commit or PR handoff. Keep each PR at 100 or fewer GitHub changed-file
entries, including deletions, renames and binaries. Preserve private state and
never read real environment files or credentials. Commits, pushes, remote
comments and merging require explicit authorization.

Initial publication is staged. Every PR runs all required checks for its published
scope through the same canonical full command as local validation, regardless of
changed paths. The runner rejects omitted, repeated or non-required entries in
the full profile before executing commands. Focused profiles are development
tools and cannot replace the PR gate; add real application checks as their source
is published, before any runnable panel merge.

The semantic YAML guard rejects PR event filters, conditional/advisory validation,
non-root commands and missing or reordered installation/full steps. Its current
single-job policy rejects checks assigned elsewhere; extend that policy deliberately
before introducing real multi-job application validation.

Use native CI, CodeRabbit and SonarQube Cloud evidence for the current revision.
CodeRabbit reviews are manual-only. Before a request, require every non-CodeRabbit
required check for the published phase to pass for the latest head, including the
scanner and actual Sonar quality gate, and verify zero open/unresolved issues of
any severity in its complete applicable Sonar report, including existing code.
Missing or stale evidence blocks requests; new commits invalidate preflight.
A documented false positive still open at Sonar blocks requests too. Follow
[Contributing](CONTRIBUTING.md#before-requesting-coderabbit) for authorization,
quota and duplicate-request rules; exclude CodeRabbit's own check/approval only
from preflight to avoid a cycle. Keep assistant guidance in English and maintained
human documentation in English and Persian.
