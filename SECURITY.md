# Security policy

## Report a vulnerability privately

Use **Report a vulnerability** in the repository's GitHub **Security** tab when
private reporting is available. Otherwise, ask the repository owner for a
secure channel before sharing technical details. Keep reports and sensitive
details out of public issues, pull requests, commits and logs.

Include the affected revision, feature or endpoint, expected and observed
behavior, potential impact and steps using synthetic data. Redact credentials,
tokens, personal information and sensitive payloads from the report and any
attachments. Review error messages and nested causes before sharing them.

For a failed request, include the HTTP status and a sanitized request ID if
available. Use a route template such as `/users/:id` instead of a real URL
with identifiers or query values. Keep cookies and authorization headers out
of the report. [Private vulnerability reporting](https://github.com/sepaseh/kernel-admin/security/advisories/new)

## Boundaries to preserve

| Boundary                                  | Required behavior                                                                                                                                                                                        | Detailed owner                                                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Browser credentials and asynchronous work | Bearer credentials stay in memory. Login/logout generations, bounded shared refresh, cancellation and post-fulfillment guards prevent old work from changing a newer login.                              | [Authentication and requests](docs/authentication.md)                                                                                   |
| Server authority                          | The API authorizes every operation and owns session revocation, abuse controls, data, uploads and storage. Client route guards and hidden controls only govern presentation.                             | [Application architecture](docs/architecture.md)                                                                                        |
| Untrusted responses and diagnostics       | The token parser requires a nonblank access-token string. The settings adapter trusts typed metadata at runtime. The client checks request-ID format. Server error messages and causes remain untrusted. | [Token parser](src/shared/api/token.ts), [shared client](src/shared/api/client.ts) and [settings adapter](src/features/settings/api.ts) |
| Public settings and preferences           | Language, direction and calendar remain API-owned; browser preferences contain theme/compact only.                                                                                                       | [Localization](docs/localization.md)                                                                                                    |

Review HTTP, token/cookie, CORS/Origin and permission expectations against the developer's selected backend when its integration boundary changes. Preserve the single eligible protected-401 replay and avoid automatically replaying writes after ordinary transient failures. Synthetic consumer contracts do not establish provider behavior, cookie security or a completed security audit.

## Configuration and operations

Never commit real environment files, tokens, private keys, operator certificates, databases or uploads. Public build configuration is visible to browsers. Public examples contain synthetic values and do not authorize inspecting local state.

Keep TLS material outside images/build contexts and mount it read-only. Maintain explicit allowed origins and CSP, trusted template inputs, immutable release identity and path/link protection. Packaging and configured controls do not establish a trusted certificate, safe artifact or deployed availability.

Use synthetic disposable data for source checks. Real deployment, Docker, staging, smoke, DAST or external reporting requires explicit target/operation authorization. Preserve first failures and residual limits instead of claiming desired controls are already implemented. See [deployment](docs/deployment.md) and [validation](docs/validation.md).

## Review a security-sensitive change

Locate the enforcing source and its closest failure-path tests before changing a boundary. Check stale sessions, cancelled work, denied permissions and malformed responses as applicable. Follow the current [validation procedure](docs/validation.md) and report which boundary was actually exercised. Record provider or deployment verification separately when the change depends on an external system.
