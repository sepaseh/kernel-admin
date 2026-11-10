# Source changes for discussion

When production source is preserved, record its exact owner, triggering action,
evidence and smallest proposal here before discussing an edit. A failing check
does not authorize a source rewrite or a weaker assertion. Correct a faulty
fixture only when evidence supports that conclusion.

The observations below predate the current reset of files outside `src/`.
Production source was preserved during that reset. Form-submission cancellation,
the type-only corrections and four narrow ARIA role corrections below were
subsequently authorized separately.
Historical observations do not validate the current source/tooling snapshot.
The focused results below apply only to their recorded tree; current publication
results belong to the PR and its verification artifacts.
Keep confirmed failures, intermittent observations and unproven concerns distinct.

## Publication typecheck finding

A locked installation and `npm run typecheck` on tree
`e8872e387756209fd8d8f3edf5b2ef605b9c2591` reported TS2322 in
`src/shared/hooks/useDebouncedFilters.ts:16`: the browser timer returns a number,
while `ReturnType<typeof window.setTimeout>` resolves to the Node timeout overload
under the combined application/tooling declarations. Minimal proposal: type the
timer ref as `number | undefined`, retaining the same browser timer, delay,
cancellation and effect lifecycle. The user authorized this exact type-only
correction; it is applied. A later focused `npm run typecheck` exited 0 on PR2 tree
`a11e997e5fd21e49d25dfde4a86dbc4eccc996e1`.

## Accepted initial-read failure behavior

The user does not require a Retry control or an editing lock after an initial
read fails. This includes Calendar: its historical retry/blocking assertion is a
withdrawn product expectation, not a pending production defect. No production
change is requested for that behavior.

The user authorized adapting those product assertions. Tests retain localized
error visibility, bootstrap readiness gates, permissions, cancellation and
stale-result checks. The Users browser scenario also retains accepted-row and
same-query reload assertions, using existing filters to load again. Mandatory
validation profiles, security and accessibility checks remain required.

## Current source decisions and publication status

The user approved only four narrow accessibility changes: the loading Spin in
[RouteLoading](../src/shared/ui/route-loading/RouteLoading.tsx),
[Core](../src/app/providers/core/Core.tsx) and
[Default](../src/layouts/default/Default.tsx) now has a status role, and the
[RoleForm](../src/features/roles/components/role-form/RoleForm.tsx) permission-group
Divider has a presentation role. These changes are applied; they do not establish
a successful accessibility run.

Core loads global settings on its initial mount. The user does not require a
refetch when the window regains focus. Former focus-refresh and malformed-on-focus assertions are
withdrawn; metadata authority tests must use actual accepted settings responses
or a fresh mount while preserving cancellation and readiness checks.

The user declined further accessibility source changes, a new 1,000-character
name limit and changes to ordinary Settings editors' language payloads. Preserve
the genuine accessibility, name-limit and nonadministrator language-authority
regressions and report their failures. The mandatory full gate remains in force:
the four application PRs remain blocked while required checks fail. Preparing
local PR descriptions does not establish publication or approval.

The unused-code review restored [asset integrity](../src/assets/assets.test.ts)
and [multipart transport](../src/shared/api/transport.test.ts) coverage and retained
fontkit and MSW. Only the two directly unused Testing Library development
dependencies were removed; Storybook still owns its matcher and user-event
implementations. Public exports and types remain unchanged. The unused Routes,
localeCodes, PasswordFormParams and ThemeColors export findings remain unresolved
until their interface or removal is explicitly decided; no synthetic consumers or
broad analyzer exclusions were introduced.

## Pending behavior

| Owner and trigger                                                                                                                                                                                 | Prior evidence                                                                                                                            | Minimal proposal / decision                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [FormDrawer](../src/shared/ui/form-drawer/FormDrawer.tsx), [Users confirmation](../src/features/users/Users.tsx), [Antd](../src/app/providers/antd/Antd.tsx): Tab from drawer Submit or modal Yes | Eight English/Persian light/dark browser cases observed BODY as activeElement and `document.hasFocus() === false`.                        | Review supported focus containment while preserving Escape, cancellation and trigger restoration.                                                        |
| [Users](../src/features/users/Users.tsx), [Roles](../src/features/roles/Roles.tsx), [Default](../src/layouts/default/Default.tsx): render at 390px                                                | Four table cases observed document overflow or an overflowing table without a named keyboard scroll region; axe also reported missing h1. | Contain actual overflow and review headings without forcing the former layout. Fitting tables need no extra scroll region.                               |
| [Settings](../src/features/settings/Settings.tsx): ordinary `settings.update` editor saves appearance                                                                                             | The language-authority case observed `language_code: "en"` in PUT despite no system-admin language rights.                                | The user declined this source change. Preserve the ordinary-editor language-authority regression and report the failure; required gates remain blocking. |

## Accessibility findings in synthetic palettes

These prior Storybook/browser measurements describe synthetic rendered states,
not the palette of a live backend. Keep interaction assertions and axe audits.
Incomplete/background-overlap entries do not establish a measured contrast ratio.

| Exact production owner and trigger                                                                                                                                                       | Prior evidence                                                                                                 | Minimal proposal                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [RouteLoading](../src/shared/ui/route-loading/RouteLoading.tsx), [Default](../src/layouts/default/Default.tsx), [Core](../src/app/providers/core/Core.tsx): loading Spin with aria-label | Axe `aria-prohibited-attr` on its role-less wrapper in loading stories.                                        | The user-authorized status-role correction is applied. Fresh verification is still required.           |
| [Login](../src/features/login/Login.tsx), [PasswordForm](../src/features/account/components/password-form/PasswordForm.tsx): invalid credentials/password mismatch                       | Light error text `#ff4d4f` on white measured 3.26:1.                                                           | Review the accepted light-palette error token while retaining validation feedback.                     |
| [Calendar](../src/features/calendar/Calendar.tsx): adjacent-month dates                                                                                                                  | `#c4c4c4` on white measured 1.74:1.                                                                            | Review secondary date colors without changing date/read-only semantics.                                |
| [Default](../src/layouts/default/Default.tsx): Persian dark selected dashboard link                                                                                                      | `#1668dc` on `#1f1f1f` measured 3.17:1.                                                                        | Review selected navigation tokens.                                                                     |
| [Navigation](../src/layouts/default/components/navigation/Navigation.tsx): inline Roles link                                                                                             | One complete run measured 1.07:1 (`#f7f7f7` on white); settled palette versus transition timing is unresolved. | Establish rendered palette/audit readiness before proposing a source or fixture correction.            |
| [RoleForm](../src/features/roles/components/role-form/RoleForm.tsx): permission-group checkbox inside Divider                                                                            | Six create/update/validation scenarios reported axe `nested-interactive` for the separator container.          | The user-authorized presentation role is applied to the Divider. Fresh verification is still required. |
| [Users](../src/features/users/Users.tsx): Select placeholders                                                                                                                            | Light placeholder 1.74:1.                                                                                      | Review accepted Select placeholder tokens.                                                             |

## Observations that still need a controlled reproduction

- FAQ keyboard sorting: one complete run kept the drag status at the first
  droppable area after ArrowDown and sent no sort request; earlier runs passed.
  Sensor-listener readiness is a hypothesis. Establish that boundary before
  changing [FAQ](../src/features/faqs/Faqs.tsx) or its fixture.
- [UserRoleForm test](../src/features/users/components/user-role-form/UserRoleForm.test.tsx):
  one complete run saved `roleIds: []` after two checked options; an isolated run
  passed. Determine Checkbox.Group/form readiness before a source/fixture edit.
- [Routes test](../src/app/Routes.test.tsx): one complete run exceeded the existing
  five-second first-route limit; isolated 16/16 passed. Identify the delayed
  import/render boundary without weakening the assertion or deadline.

## Applied source-test type-import corrections

The earlier clean export `307fe066e267-1794316248205` reported 14
`@typescript-eslint/consistent-type-imports` errors in 13 source test files.
The table lists the currently admitted owners from that report.
Its original output is retained at `coverage/non-src-final/full-verification.log`.
These are type-import policy findings, not runtime or OTP accessibility defects.
The Antd 6.6.8 OTP regressions were separately identified as dependency compatibility.

| Exact source file                              | Prior line:column |
| ---------------------------------------------- | ----------------- |
| `src/features/auth/api.test.ts`                | 11:46             |
| `src/features/faqs/api.test.ts`                | 7:34              |
| `src/features/files/api.test.ts`               | 7:34              |
| `src/features/forgot-pass/ForgotPass.test.tsx` | 24:29             |
| `src/features/register/Register.test.tsx`      | 24:29             |
| `src/features/roles/api.test.ts`               | 16:35             |
| `src/features/users/api.helpers.test.ts`       | 8:29              |
| `src/features/users/api.test.ts`               | 7:34              |
| `src/layouts/default/Default.test.tsx`         | 31:29,36:29       |
| `src/shared/ui/otp-input/OtpInput.test.tsx`    | 2:1               |
| `src/test/resource-paths.test.ts`              | 10:34             |

The flagged `import()` type queries now use erased namespace/named imports,
and OtpInput uses an `import type`, preserving mocks and assertions. Focused
`npm run typecheck` and `npm run lint` both exited 0 on PR2 tree
`a11e997e5fd21e49d25dfde4a86dbc4eccc996e1`.
Vitest separates application tests in jsdom from tooling tests in Node through
its project configuration. Advisory sorting warnings are separate findings.
