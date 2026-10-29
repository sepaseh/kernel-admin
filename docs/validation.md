# Canonical validation policy

[English](validation.md) · [فارسی](validation.fa.md)

[The manifest](../.agents/validation.json) owns command IDs, kinds, scopes, job ownership and profiles. The application-verification phase retains all twelve inherited checks and adds seven genuine application checks. Settings are an ordered projection of full. Unknown IDs, duplicate definitions, omitted required checks and advisory/manual entries in full fail before execution. Do not maintain a second complete command list.

Start with the smallest relevant check. Before every authorized commit, push or PR handoff, export the exact final proposed tree and run npm ci, npm run browser:install and npm run validate -- full with [.nvmrc](../.nvmrc) and its npm. The full profile stops on failure; audit unavailability and missing browser/runtime prerequisites are failures, never passes. Revalidate changed final source rather than testing a mixed primary directory with unpublished files.

Unit and governance tests emit genuine coverage/unit/lcov.info and coverage/governance/lcov.info from the same revision. Preserve minimum unit coverage of 69% lines, 68% statements, 59% functions and 54% branches. Guidance and portable Node hook regressions join governance once; optional Bash cases report unavailable prerequisites honestly. Do not reduce coverage, timing bounds, budgets or accessibility rules to hide failures.

Storybook keeps isolated synthetic configuration and complete API/client mocks. The admitted application adds unused-code analysis, production build, bundle budgets, Pact consumer interactions, real application browser/accessibility tests, provenance-bound visual comparison and Lighthouse. API-provider compatibility and deployed operation remain separate. All browser tests fail closed on unexpected requests; source verification never loads real environment files or operator state.

CI and scanner install dependencies and browsers before the exact unconditional root full command. The application jobs use matching Windows prerequisites and genuine commands, with no shell override or checkout revision replacement. Check actual current-head job results, scanner execution, asynchronous Sonar quality gate and the complete unresolved issue report; configuration is not execution. Remote protection changes require authorization and actual observed build/e2e/visual contexts before runnable merge.

Visual baselines require matching source and runtime provenance plus actual human review of every fresh image. A comparison pass against an unreviewed capture is insufficient. Historical metadata remains historical. Production deployment, provider verification, DAST, mutation and independent operator workflows are not inferred from local application results. See [testing](testing.md), [Contributing](../CONTRIBUTING.md), [visual provenance](visual-regression.md) and [branch protection](branch-protection.md).
