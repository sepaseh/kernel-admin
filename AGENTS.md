# Assistant entry point

Read [`.agents/README.md`](.agents/README.md), its [settings index](.agents/settings.json), [source navigation](docs/source-navigation.md) and the relevant canonical rules before changing source. Use repository scripts and follow [Contributing](CONTRIBUTING.md).

## Scope and safety

Preserve user changes, including unrelated tracked and untracked files. Never read real environment files, credentials, keys, databases, uploads or browser state as fixtures. Do not commit, push, publish, contact production or run an operational target without authorization covering that action. Existing authorization and user preferences remain valid within their scope.

Use the existing checkout. Creating an additional Git worktree, clone or copied
implementation checkout of this repository requires prior explicit user
authorization, including when delegated to a subagent. Follow the
[working-checkout rule](.agents/rules/branches.md#working-checkout).

Keep one standalone root project. Do not introduce workspaces, backend SDKs, local-package links or external project source dependencies. The consuming developer chooses a backend implementing the local HTTP contract; frontend work requires no external project source or documentation. Authentication execution, authorization and storage remain behind HTTP; menus and client guards do not replace server enforcement.

## Source contracts

Use the existing React, Ant Design/antd-style, React Router and Axios owners. Feature API/types stay with the feature; shared transport/session state stays in `src/shared/api`; request hooks stay in `src/shared/hooks`.

Preserve memory-only tokens, login/logout generations, shared bounded refresh, cancellation and stale-result guards. Read [authentication and requests](docs/authentication.md) before changing these flows.

Keep complete local application catalogs and API-owned language, direction and calendar. Browser preferences own theme/compact only. English-only documentation does not remove product translations. Read [localization](docs/localization.md).

For interface work, read [DESIGN](DESIGN.md), the closest component/story and [the design skill](.agents/skills/design-ui/SKILL.md). Preserve permission, keyboard, contrast, motion, responsive and RTL/LTR behavior.

## Verification and documentation

The [validation manifest](.agents/validation.json) owns commands and profiles. Start focused, then run the declared full gate on the exact isolated proposed source before an authorized commit, push or handoff. Do not weaken checks, coverage, tolerances or security controls to pass them. Report actual execution and limits; configuration alone is not evidence.

Target at most 80 GitHub changed-file entries when opening a PR, reserving 20 for
review fixes under the hard 100-entry limit. Count additions, deletions, renames
and binaries; follow [pull-request policy](.agents/rules/pull-requests.md).

Keep documentation and assistant instructions in English, current and task-oriented; do not add translated companions or bilingual navigation. Preserve all ten UI catalogs, Persian calendar data and clearly identified localized product examples or synthetic UI fixtures; their explanatory prose stays English. Use [the documentation map](docs/README.md); update the existing owner guide instead of adding dated QA reports or decision logs. Optional host adapters and hooks do not grant permission or prove automatic loading.

Only reviewed public examples at `.env.example`, `deploy/docker/compose.env.example` and `deploy/native/nginx.env.example` may enter source fixtures. A filename does not authorize reading a private local counterpart. Deployment/helper CLIs can write files, start resources and contact targets: read [deployment](docs/deployment.md) before invoking them.
