# Kernel Admin design context

[English](DESIGN.md) · [فارسی](DESIGN.fa.md)

Use this guide when designing, building or refining the published components.
The current `assistant-guidance` phase retains `applicationReady: false`: layouts,
forms and route metadata are published, but application entry and App/Routes
composition, production build, complete E2E and visual baselines remain future work.
Read [AGENTS](AGENTS.md) and the relevant canonical rules; use the
[design workflow](.agents/skills/design-ui/SKILL.md) to select a deliverable and
verification. This is an administration application with permission-aware data,
forms and navigation. Its existing implementation is the design starting point.

## Deliverable and available tools

Choose the deliverable from the user's request before choosing a tool:

- **Concept, asset or Figma handoff:** use available design/image tools when they
  fit the requested output. Inspect the relevant installed tool skill first. Reuse
  the local components, tokens and assets below as references; an image or design
  file does not implement routes, permissions or HTTP behavior.
- **Runnable repository code:** edit the owning feature and existing providers in
  this checkout. Keep React/Vite, Ant Design/antd-style, React Router and Axios.
  Do not replace the component or styling stack to match a tool's generic starter.
- **Hosted prototype:** use an available hosting workflow only when that is the
  requested result. Check compatibility and preserve the intended stack and
  source ownership; report its verified URL and limits separately from repository
  implementation. This guide does not authorize private-source upload or publication.

Tool integrations are optional assistant capabilities, not runtime dependencies.
If a requested tool is unavailable, state that limitation and continue the useful
local work supported by the task. Resolve only material output ambiguity with the
user; do not invent a design service or silently substitute a different deliverable.

## Source of visual decisions

| Concern                                  | Read and reuse                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Components and styling                   | [Styling](.agents/rules/styling.md), [React](.agents/rules/react.md); Ant Design props first, antd-style for owned custom styles, local inline layout tweaks.                                                                                                                                                                                          |
| Colors, spacing, density and breakpoints | [Theme builder](src/shared/config/theme.ts): `createThemeConfig`, Ant Design semantic tokens, light/dark/compact algorithms, contrast correction and API palette overrides. Read values there rather than creating another token registry.                                                                                                             |
| Typography and motion                    | [Global styles](src/assets/styles/index.css), [font declaration](src/assets/styles/vazirmatn.css), [Vazirmatn font](src/assets/fonts/vazirmatn/Vazirmatn-Variable.woff2) and [license](src/assets/fonts/vazirmatn/OFL.txt). Preserve visible keyboard focus and reduced-motion behavior.                                                               |
| Icons and logos                          | Direct named Lucide icons with explicit size/currentColor and decorative `aria-hidden`; translated control names. [Default logos](src/shared/config/theme.ts) use the [local SVG](public/logo.svg), while [Core](src/app/providers/core/Core.tsx) applies API logos. Preserve licenses and existing assets; a fallback asset is not a new brand brief. |
| Language, direction and dates            | [Localization rule](.agents/rules/localization.md), [Core](src/app/providers/core/Core.tsx), [AntdProvider](src/app/providers/antd/Antd.tsx), [date adapter](src/shared/i18n/date.ts). API metadata determines direction/calendar; the catalog code selects vendor adapters only.                                                                      |
| Routes and authorization                 | [Route definitions](src/app/config/routes.ts), [access policy](src/app/lib/access.ts) and feature API/types. A hidden or disabled control does not replace API authorization.                                                                                                                                                                          |

Reuse flat root translation keys in the ten [local catalogs](src/shared/i18n/locales)
and preserve interpolation. There is no user language selector or remembered
browser language. Only the system super-admin changes global language; ordinary
`settings.update` editors retain theme/logo rights and omit the language field.
Theme and compact mode remain browser preferences. See [Settings](src/features/settings/Settings.tsx).

## Existing recipes

| Design task                                 | Starting examples                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application shell and responsive navigation | [Default layout](src/layouts/default/Default.tsx), [its stories](src/layouts/default/Default.stories.tsx): token-based maximum width, logical spacing, desktop menu and smaller-screen drawer.                                                                                     |
| Public form or authentication panel         | [Auth layout](src/layouts/auth/Auth.tsx), [Login](src/features/login/Login.tsx) and [login styles](src/features/login/styles.ts): focused fields, translated labels, branded API logo and submission/error states.                                                                 |
| Filterable data table and actions           | [Users](src/features/users/Users.tsx), [state stories](src/features/users/Users.stories.tsx): populated, empty, loading, error and read-only examples. Keep delete triggers neutral; danger styling belongs to confirmation.                                                       |
| Create/update form drawer                   | [UserForm](src/features/users/components/user-form/UserForm.tsx), [FormDrawer](src/shared/ui/form-drawer/FormDrawer.tsx): typed Ant Design Form, focus/reset lifecycle and shared footer.                                                                                          |
| Settings or calendar                        | [Settings](src/features/settings/Settings.tsx), [Calendar](src/features/calendar/Calendar.tsx): responsive columns, permission-aware mutation and API-owned language/calendar. HTTP calendar date keys stay Gregorian `YYYY-MM-DD`.                                                |
| Request and failure feedback                | [useReadResource](src/shared/hooks/useReadResource.ts), [RequestFeedback](src/shared/ui/request-feedback/RequestFeedback.tsx), [request lifecycle](docs/admin-request-reliability.md): cancellation/stale guards, explicit manual read retry and retained data on refresh failure. |

Inspect the closest source and its `*.stories.tsx` before inventing another
component. Keep feature-specific UI beside its owner; use `src/shared/ui` for
actual reusable primitives, following [imports](.agents/rules/imports.md).

## States and review evidence

For affected interactions, consider populated/empty/loading, initial failure and
retry, stale refresh with existing data, validation/submission/success, and allowed
versus read-only actions. Match the existing request/session guards when connecting
the design to HTTP. Review narrow and desktop layouts, long translations,
API-supplied RTL/LTR, light/dark/compact themes, keyboard focus and reduced motion
where the change affects them.

[Storybook preview](.storybook/preview.tsx) uses the same theme builder and complete
synthetic API replacements. Language metadata, direction and theme controls are
design/test fixtures, not visitor preferences. The [real Chromium workshop suite](docs/storybook-verification.md)
checks component interaction and accessibility, with violations treated as errors.
It does not establish application E2E, manual screen-reader review or visual-regression
approval. Those later checks must be introduced and genuinely run before a runnable
panel merges; unpublished or historical screenshots are not fresh design approval.

Select checks from the [validation manifest](.agents/validation.json) using
[validation policy](docs/validation.md). Static guidance checks prove links and
inventory consistency; they do not prove aesthetic quality, human review or that
a host loaded these instructions. Report actual source changes, checks, visual
inspection and remaining limitations. Keep synthetic fixtures separate from real
environment files and user data.

## Optional host setup

[AGENTS](AGENTS.md) and [.agents/skills/design-ui](.agents/skills/design-ui/SKILL.md)
are the local source of guidance. [CLAUDE.md](CLAUDE.md) and the
[Claude skill adapter](.claude/skills/design-ui/SKILL.md) point to those same rules.
They are optional host entry points, not application dependencies or proof that
a host automatically loaded the files.

Use the actual installed host/tool skill when a task requires image generation,
Figma or a hosted prototype. Verify availability and access in that session; adding
this guide does not authorize private-source upload, hosting or publication. Keep
real font/assets, licenses, existing components and tokens as the design reference.
A remote design or hosted artifact does not update this repository by itself.

Record host-provided loaded-file evidence and use the read-only design case in
[comprehension evaluation](docs/comprehension-evaluation.md). Without that evidence,
automatic discovery remains unknown; successful static checks are not a host benchmark.
