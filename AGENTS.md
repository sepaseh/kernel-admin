# Kernel Admin runtime-localization instructions

Read [README](README.md), [Contributing](CONTRIBUTING.md), the current
[publication inventory](.github/bootstrap-policy.json) and canonical
[validation manifest](.agents/validation.json) before changes.

This standalone npm project publishes framework-free admin primitives, ten
complete flat catalogs and real local translation/date adapters. Keep source
independent of another checkout, backend SDKs, npm workspaces and UI initialization.
The separate API owns authentication execution, database access and storage.

Read [localization](docs/localization.md). Keep one code-named catalog per language,
110 complete root string messages and i18next interpolation parity; no common
objects, compatibility aliases or runtime English fallback inside leaf data.
Leaf catalogs, locales.ts and dayjs/fa.ts accept only fully erased local types.
Only catalogs.ts loads the canonical catalog objects. Data cannot import adapters.

The runtime adapter owns i18next/react-i18next initialization with fixed Persian
bootstrap fallback. Never read or persist a visitor language preference. The date
adapter registers all ten real Day.js locales and Jalaliday; English uses en-gb.
Code normalization selects a supported catalog only. The API remains authoritative
for active language, direction, calendar and names. The future HTTP settings
adapter must validate complete server metadata, without inferring direction or
calendar from language codes. Only a super-administrator changes active language.

The runtime-localization phase has applicationReady:false. It contains no runnable
panel, HTTP integration, production build, browser journey or visual evidence.
A runnable phase must introduce React/Vite and complete real validation, preserving
Ant Design, antd-style, React Router, Axios and directly typed component parameters
without FC aliases. Before a runnable panel merges, expand the canonical full gate,
observe genuine build/e2e/visual jobs pass and add them to required checks.

Preserve token generation, login/logout invalidation and refresh semantics. Only
the declared runtime-adapter modules may import their exact registry dependencies;
pure contracts, catalogs and primitives stay isolated. Every production module
belongs in measured coverage. Tests use synthetic state and actual installed
translation/date dependencies, never real environment files or credentials.

Run npm run validate -- full on the exact proposed snapshot before every authorized
commit or PR handoff. All nine required commands run on every PR regardless of
changed paths. The runner rejects omitted, repeated or non-required full entries;
focused profiles cannot replace the complete gate. Keep each PR at 100 or fewer
GitHub changed-file entries, including deletions, renames and binaries.

The semantic YAML guard requires unconditional root installation then the canonical
full command, with no PR filters or advisory validation. Its single-job policy must
be deliberately extended before introducing multi-job application checks.

Required native contexts remain check, PR file limit, SonarQube Cloud analysis,
SonarCloud Code Analysis and CodeRabbit. Preserve expected App identities, strict
up-to-date protection, approving review and resolved conversations. A skipped
CodeRabbit status is not a substantive review. Before one manual review request,
require all latest-head non-CodeRabbit required checks including scanner and actual
Sonar gate to pass, and zero open/unresolved issues across every page/severity of
the complete applicable Sonar report. New commits invalidate preflight. Follow
Contributing for authorization, quota and no duplicate in-flight requests.

Preserve private state; never read real environment files or secrets. Commits,
pushes, remote messages and merging require explicit authorization. Keep assistant
guidance English and maintained human documentation English/Persian.
