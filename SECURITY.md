# Security policy

[English](SECURITY.md) · [فارسی](SECURITY.fa.md)

The maintained source is on `main`. The current `assistant-guidance` phase remains `applicationReady: false`; its security tests and hosting templates do not establish a deployed or vulnerability-free application.

Do not publish suspected vulnerabilities, credentials or reproduction data in public issues, PRs or commits. Use the repository's [private vulnerability reporting](https://github.com/sepaseh/kernel-admin/security/advisories/new) when available. Include the affected revision, impact, minimal synthetic reproduction and suggested mitigation. If private reporting is unavailable, ask the owner privately for a secure channel without placing sensitive details in public. The maintainer can then validate, coordinate a fix and arrange disclosure; no response-time guarantee is implied.

Never commit real environment files, tokens, keys, operator certificates, databases or uploads. The three reviewed public example paths contain synthetic configuration only; they are not credentials or permission to inspect local state. Coordinate API authentication, authorization and storage changes with the separate API owner.

Read the [threat model](docs/security/threat-model.md), [authentication review](docs/security/authentication-review.md) and [review procedure](docs/security/reviews.md). Current canonical checks provide scoped evidence. DAST, real deployment checks and external reporting require separate authorization and actual execution.
