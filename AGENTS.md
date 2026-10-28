# Kernel Admin Storybook verification instructions

Read [README](README.md), [Contributing](CONTRIBUTING.md), the current
[publication inventory](.github/bootstrap-policy.json) and canonical
[validation manifest](.agents/validation.json) before changes.

Read [UI foundation](docs/ui-foundation.md) for Ant Design widgets, the theme adapter, compact/theme-only storage, optional observability and actual font/vector asset checks. Keep component parameters explicitly typed; no FC or FunctionComponent aliases.
Read [Core and authentication](docs/core-auth.md) for provider lifecycle, access/navigation metadata, authentication forms and layout ownership. Preserve cancellation and session generation guards; the separate API executes authentication.

This standalone npm project publishes admin primitives, ten
complete flat catalogs, real translation/date adapters, HTTP feature adapters and
request lifecycle hooks, Core/Ant Design providers, authentication forms, business screen/form modules and layouts. Read [HTTP ownership](docs/http-client.md) and
[request lifecycle](docs/request-lifecycle.md). Keep source
independent of another checkout, backend SDKs, npm workspaces and application initialization.
The separate API owns authentication execution, database access and storage.

Read [localization](docs/localization.md). Keep one code-named catalog per language,
111 complete root string messages and i18next interpolation parity; no common
objects, compatibility aliases or runtime English fallback inside leaf data.
Leaf catalogs, locales.ts and dayjs/fa.ts accept only fully erased local types.
Only catalogs.ts loads the canonical catalog objects. Data cannot import adapters.

The runtime adapter owns i18next/react-i18next initialization with fixed Persian
bootstrap fallback. Never read or persist a visitor language preference. The date
adapter registers nine vendor Day.js locales plus local Persian faDayjs and
Jalaliday; English uses en-gb.
Code normalization selects a supported catalog only. The API remains authoritative
for active language, direction, calendar and names. The HTTP settings adapter validates complete server metadata, without inferring
direction or calendar from language codes. Preserve these runtime checks. Only a super-administrator changes active language.

Read [Business screens](docs/business-screens.md) for account field ownership, guarded mutations, permission-aware forms and synthetic verification.

Read [Storybook verification](docs/storybook-verification.md) before editing stories or their
configuration. The storybook-verification phase has applicationReady:false. It adds
the static Storybook build and real Chromium play/accessibility checks for all
registered stories. Full automocks cover every feature API owner and the shared
client; synthetic fixtures reset before each story and unexpected client requests
fail the browser suite. Never use spy passthrough or contact a real API. The toolbar
selects explicit English/Persian server metadata fixtures, independently of theme
and direction; this is test support, never a visitor language preference.
There is no application entry point, App/Routes composition, production panel build,
complete application E2E journey or visual-regression evidence. Synthetic Axios/MSW,
jsdom and isolated Storybook tests do not establish full server/browser integration.
A runnable phase must introduce React/Vite and complete real validation, preserving
Ant Design, antd-style, React Router, Axios and directly typed component parameters
without FC aliases. Before a runnable panel merges, expand the canonical full nineteen-check application gate,
observe genuine build/e2e/visual jobs pass and add them to required checks.

Preserve synchronous request-intent generation binding, token generation,
login/logout invalidation, cancellation and shared-refresh semantics. Validate
unknown token/settings replies before state changes. The appearance contract
owns Theme and the seven palette fields; the Ant Design adapter must import
it. Feature wire types use only exact erased local vocabulary. Only
the declared runtime-adapter and widget modules may import their exact registry dependencies;
pure contracts, catalogs and primitives stay isolated. Every production module
belongs in measured coverage. Font assets must pass real WOFF2 cmap/axis/default-outline, license, hash and CSS-reference checks, plus safe SVG parsing; presence alone is not validation. Keep browser font loading and visual evidence for the later runnable gate. Tests use synthetic state and actual installed
translation/date/HTTP dependencies, fail-closed synthetic MSW responses and
isolated React hook rendering, never real environment files or credentials.

Install Chromium with npm run browser:install after npm ci. Run npm run validate -- full
on the exact proposed snapshot before every authorized commit or PR handoff. All eleven
required commands run on every PR regardless of
changed paths. The runner rejects omitted, repeated or non-required full entries;
focused profiles cannot replace the complete gate. Keep each PR at 100 or fewer
GitHub changed-file entries, including deletions, renames and binaries.

The canonical inventory includes the existing nine checks plus build-storybook and
test:storybook. Preserve unit thresholds of 69% lines, 68% statements, 59% functions
and 54% branches. Accessibility violations are errors; do not disable an audit to
make a story pass. Generated workshop output and browser results are not unit LCOV.
The semantic YAML guard requires unconditional root dependency installation, Chromium
installation, then the canonical full command, with no PR filters or advisory validation. Its single-job policy must
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
