# Testing

The current `assistant-guidance` phase keeps `applicationReady: false`. Vitest,
React Testing Library, synthetic MSW fixtures and the isolated Storybook Chromium
suite verify published modules. The existing 68 registered story cases use full
API/client mocks, fixture resets and failing unexpected-request guards; they do
not prove an integrated application journey or production API compatibility.

## Select the current check

Use the [validation manifest](../validation.json) and
[validation policy](../../docs/validation.md). Start with the smallest affected
check, then run `npm run validate -- full` on the exact final snapshot before an
authorized commit, push or PR handoff. Full contains twelve required checks.
Guidance and safety regressions run within the existing governance coverage
command and LCOV. The focused `guidance` profile includes the required guidance
check and advisory `test:guidance`; it does not replace the full gate.

Keep the measured unit thresholds: 69% lines, 68% statements, 59% functions and
54% branches. Do not replace genuine LCOV with static counts, Storybook build
output or browser artifacts. Required checks cannot be skipped or weakened to
make a change pass.

## Choose meaningful coverage

- Pure utility or mapper: a focused unit test for observable behavior.
- Request/session hook: an integration regression for cancellation, stale results
  and login/logout generation changes.
- Form or interactive component: a component test, plus an isolated Storybook
  interaction when the affected behavior belongs in its browser scope.
- Guidance, navigation or safety tooling: synthetic positive and negative
  governance fixtures that reject the actual bypass.
- Pure bundle/Lighthouse/production-input/target policies: synthetic unit cases in
  existing measured coverage.
- Rendering, release packaging and Docker resource/orchestration: disposable
  synthetic governance cases, without launching real infrastructure.
- Complete application E2E, current visual regression and real deployment:
  future activation work; published prerequisites/history do not execute them.

Use [request reliability](../../docs/admin-request-reliability.md),
[Storybook verification](../../docs/storybook-verification.md) and
[testing](../../docs/testing.md). Prefer accessible roles and labels, deterministic
fixtures and small reusable factories. Cover failure and authorization boundaries
rather than mirroring the implementation.

Mock feature API owners and the shared client completely; never use spy
passthrough or contact a real API. Accessibility violations are errors. Do not
disable audits or widen thresholds to hide a failure. Synthetic preview toolbar
language/direction settings do not create visitor preferences.

Use disposable, uniquely owned resources and clean only those resources. If a
future application/deployment task introduces servers, containers or visual
baselines, it must also provide genuine checks and targeted cleanup. Never read,
move or reuse real `.env.local`, credentials, `server/data`, databases, uploads or
another checkout's running service as a fixture.

Read [component coverage](../../docs/component-coverage.md), [performance policy](../../docs/performance.md) and [test reliability](../../docs/test-reliability.md). The three public example exceptions contain reviewed synthetic values only; real/local environments and operator certificates remain unread. New prerequisite suites run once in existing unit/governance commands; no third full suite or operational profile is added.

Keep existing stress corpora, assertions and bounded deadlines. Separate newly added behavior into another mandatory bounded child when appropriate rather than accumulating unrelated workload under a legacy deadline or weakening the guard. Historical Win32 assets and metadata are provenance, not a fresh screenshot pass. Real Docker/Chrome/preview/provider/staging checks require future source, explicit authorization, owned-resource cleanup and actual evidence.
