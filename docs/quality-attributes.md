# Quality attributes and evidence

[English](quality-attributes.md) · [فارسی](quality-attributes.fa.md)

The current `assistant-guidance` phase retains `applicationReady: false`. Evaluate each claim against its actual source and executed checks.

| Attribute             | Current evidence and limits                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness           | Unit/React tests cover published modules using synthetic HTTP and session-generation fixtures. Chromium checks isolated Storybook interactions, not complete application or real-provider journeys.                       |
| Ownership             | The AST boundary guard protects local contracts, flat catalogs and runtime adapters. The separate API owns authentication execution, database, storage and active language metadata.                                      |
| Accessibility         | Real Storybook audits treat violations as errors. Screen-reader review, complete application keyboard journeys and reviewed visual baselines need separate future/manual evidence.                                        |
| Maintainability       | Canonical validation, semantic CI, navigation/evaluation checks and guidance regressions protect consistency. Static links do not demonstrate comprehension.                                                              |
| Coverage and security | Actual unit/governance LCOV, unchanged coverage thresholds, dependency audit and native Sonar measure different risks. None proves absence of vulnerabilities; source exclusions or weaker checks must not hide failures. |

Report failure, pending, skip, advisory and manual status explicitly. Production build budgets, application E2E, visual comparison, operator recovery and CodeQL/mutation workflows are not published by this phase. Use [validation](validation.md), [Storybook scope](storybook-verification.md) and [comprehension evaluation](comprehension-evaluation.md); do not substitute historical or another repository's evidence for a current-head result.
