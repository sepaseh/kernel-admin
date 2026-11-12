# Source changes for discussion

When production source is preserved, record its exact owner, triggering action,
evidence and smallest proposal here before discussing an edit. A failing check
does not authorize a source rewrite or a weaker assertion. Correct a faulty
fixture only when evidence supports that conclusion.

For each request, identify the production file and relevant line, the action
that exposes the issue, the observed failure or test evidence, and the smallest
proposed change. Distinguish confirmed failures, intermittent observations and
unproven concerns. Discuss the source change before applying it.

## Current PR 19 repair decisions

The investigated head was `5d74d6751f9100dc9ed0e4f3f09e53a63fa1315d`.
[CI run 43157884027](https://github.com/sepaseh/kernel-admin/actions/runs/43157884027)
reported failed static, Storybook, application E2E and visual checks. Its unit,
governance, audit, build and consumer-contract jobs passed. The failures below
are distinct from the locally unavailable Chromium download (HTTP 403).
Production edits require discussion with the owner. Do not add timeouts or
weaken genuine assertions to make a check pass.

| Owner and trigger                                                                                                                                                                                                                                                        | Current evidence                                                                                                                                                                                                                        | Smallest proposal for discussion                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/index.ts`, `src/shared/i18n/index.ts`, `src/features/account/components/password-form/index.ts`, `src/features/account/components/password-form/PasswordForm.tsx`, `src/shared/contracts/index.ts` and `src/shared/contracts/appearance.ts`: run `check:unused` | Two unused exports (`Routes`, `localeCodes`) and three exported-type entries (`PasswordFormParams`, `ThemeColors` in two files). Real consumers already use their owning modules; the standalone app has no external package consumers. | The owner approved removing redundant barrel exports and keeping implementation-only types local. The cleanup retains implementations and real consumers, without synthetic consumers or analyzer exclusions.                                         |
| `src/features/settings/Settings.tsx`: an ordinary settings editor submits appearance                                                                                                                                                                                     | The disabled language Select contributes its stored value to the PUT payload.                                                                                                                                                           | The owner accepts this behavior because the backend ignores unauthorized language changes. Withdraw the omission assertion; preserve the disabled chooser, appearance updates and API-response language authority. Production code remains unchanged. |
| `src/app/providers/antd/Antd.tsx`, `src/features/calendar/styles.ts`: render validation errors, placeholders, selected navigation and adjacent-month dates                                                                                                               | The investigated Storybook run reported 20 color-contrast failures, including light error text at 3.26:1 and adjacent-month dates at 1.74:1.                                                                                            | The owner declined color overrides and withdrew contrast thresholds from the current product test scope. Keep source and synthetic API palettes unchanged; retain all unrelated accessibility audits.                                                 |
| `src/layouts/default/Default.tsx`, `src/features/users/Users.tsx`, `src/features/roles/Roles.tsx`: audit a management page                                                                                                                                               | The investigated E2E run reported missing page-heading and table accessibility findings.                                                                                                                                                | The owner declined extra heading and named keyboard-scrolling requirements. Remove the corresponding assertions and axe rules; retain translated content, RTL layout, ordinary overflow checks and other keyboard behavior.                           |
| `e2e/accessibility.spec.ts`: audit registration                                                                                                                                                                                                                          | Four cases required `maxlength="1000"`, although the current form and HTTP contract do not define that product limit.                                                                                                                   | The owner withdrew this historical test-only expectation. Preserve required-field, focus and remaining axe assertions without adding a new product limit.                                                                                             |

The investigated visual job reported six stable screenshot differences after the
page migration. The owner reviewed those six exact images and accepted their use
as updated baselines, retaining the original failed comparison and its source and
runtime provenance. The owner also reviewed and accepted the real full-page
Settings image (1280 by 1455) captured at head
`e58e59cc564a2f93b2b9e14357e376bbef27c45d` by
[CI run 43169442527](https://github.com/sepaseh/kernel-admin/actions/runs/43169442527),
using its `settings-reference-candidate` attachment. It is admitted as the
seventh baseline, `admin-settings-en-light.png`, with the actual image hash,
runtime and source provenance. The original missing-baseline comparison remains
recorded as failed; human approval does not rewrite that execution result.
The Users screenshot already exists. A larger timeout cannot resolve stable
image differences.
The native overlay focus decision is detailed below; its production behavior is
accepted and the corresponding boundary-cycling assertions are withdrawn.

## Native overlay focus decision

[CI run 43164577678](https://github.com/sepaseh/kernel-admin/actions/runs/43164577678)
tested head `78d8f04aedf3af73d66f9277890d91344462dd50`: all 104 Storybook
cases passed, while application E2E reported 51 passed and eight failed. All
eight failures concern cycling Tab across the last control in the role drawer
or delete confirmation, in English/Persian and light/dark appearances.

The confirmation diagnostics establish a focused document and the Yes button
before Tab; immediately afterward, `document.hasFocus()` is false and the active
element is BODY. Activating the isolated browser page before the test did not
correct this boundary behavior. The locked Ant Design focus utility records a
desired next element on keydown but restores it through a later `focusin` event;
moving into browser chrome does not produce that document event.

The production owners are [FormDrawer](../src/shared/ui/form-drawer/FormDrawer.tsx)
and [Users confirmation](../src/features/users/Users.tsx). The owner accepted the
existing native Ant Design behavior and explicitly withdrew the custom
boundary-cycling expectations. Their tests retain initial focus, Escape,
trigger restoration and no accidental deletion. Remove the diagnostic-only
page-activation prerequisite along with the rejected cycling assertions;
preserve the failed run's diagnostic artifacts. No production workaround,
timeout, sleep or retry is added.

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

The user previously approved four narrow accessibility changes: the loading Spin in
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

The owner declined further color, heading and keyboard-scrolling source changes,
a new 1,000-character name limit and changes to ordinary Settings editors'
language payloads. The corresponding product expectations are now withdrawn,
as detailed above and in [test scope](testing.md#review-appearance). Preserve
unrelated assertions and the canonical validation profiles. The owner permits
HTTP 403-dependent checks to remain unavailable; report that limitation without
claiming those checks passed. Other unresolved required failures still need
investigation.

The unused-code review restored [asset integrity](../src/assets/assets.test.ts)
and [multipart transport](../src/shared/api/transport.test.ts) coverage and retained
fontkit and MSW. Only the two directly unused Testing Library development
dependencies were removed; Storybook still owns its matcher and user-event
implementations. The owner subsequently approved removing the unused Routes,
localeCodes, PasswordFormParams and ThemeColors exports while retaining local
implementations and type shapes. No synthetic consumers or broad analyzer
exclusions were introduced.

## Pending behavior

| Owner and trigger                                                                                                                                                                                 | Prior evidence                                                                                                                         | Minimal proposal / decision                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [FormDrawer](../src/shared/ui/form-drawer/FormDrawer.tsx), [Users confirmation](../src/features/users/Users.tsx), [Antd](../src/app/providers/antd/Antd.tsx): Tab from drawer Submit or modal Yes | Eight English/Persian light/dark browser cases observed BODY as activeElement and `document.hasFocus() === false`.                     | Accepted native Ant Design behavior; boundary-cycling expectations withdrawn. Preserve initial focus, Escape and trigger restoration.                    |
| [Users](../src/features/users/Users.tsx), [Roles](../src/features/roles/Roles.tsx), [Default](../src/layouts/default/Default.tsx): render at 390px                                                | Earlier cases observed document overflow or an overflowing table without a named keyboard scroll region; axe also reported missing h1. | Extra H1 and keyboard-scrolling-region requirements were withdrawn. Retain the separate ordinary viewport/RTL assertions.                                |
| [Settings](../src/features/settings/Settings.tsx): ordinary `settings.update` editor saves appearance                                                                                             | The language-authority case observed `language_code: "en"` in PUT despite no system-admin language rights.                             | Accepted: the backend ignores unauthorized language changes. Retain response authority and appearance permissions; withdraw only the omission assertion. |

## Accessibility findings in synthetic palettes

These prior Storybook/browser measurements describe synthetic rendered states,
not the palette of a live backend. Contrast is no longer a current blocking
product requirement; the measurements below remain historical observations.
Keep interaction assertions and the remaining axe audits.
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

## User-role fixture readiness

The [UserRoleForm test](../src/features/users/components/user-role-form/UserRoleForm.test.tsx)
intermittently submitted `roleIds: []` instead of the two selected identifiers,
including in [CI 208](https://github.com/sepaseh/kernel-admin/actions/runs/43193852506/job/131105640676).
A checked option alone does not establish that the remounted Checkbox.Group has
finished its option-registration effects. The fixture now resolves its owned
initial read inside awaited `act`, verifies enabled controls and the initial
selection, and checks both selected options before submission. The exact
two-identifier request assertion remains unchanged. No application or vendor
implementation is replaced to obtain that result; the original failure is retained.

## Observations that still need a controlled reproduction

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
