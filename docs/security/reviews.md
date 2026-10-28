# Security review records

[English](reviews.md) · [فارسی](reviews.fa.md)

Use the [authentication checklist](authentication-review.md) and [threat model](threat-model.md) before changing identity, authorization, cookies/tokens, recovery or release boundaries. Record request/scope, exact source revision, reviewer/date, synthetic reproduction, observed risk, tests actually executed and residual uncertainty.

Separate implemented controls, configured tools, historical records and fresh executed evidence. The current canonical checks, CodeRabbit review and native Sonar report have distinct scopes; a workflow file, green gate or approved PR is not a guarantee of no vulnerabilities. Before a manual review request, preserve the [complete latest-head preflight](../../CONTRIBUTING.md#before-requesting-coderabbit).

Deployment/staging/DAST, production TLS review and real provider testing are future authorized procedures. Do not claim CodeQL, mutation, DAST or provider execution from unavailable workflows or local pure-helper tests. Keep scan artifacts and exploitable details private, and use the [security reporting policy](../../SECURITY.md).

Synthetic fixtures must not read operator environments, credentials, databases or uploads. Keep API behavior with its independent owner and record compatibility/rollout decisions when a wire boundary changes.
