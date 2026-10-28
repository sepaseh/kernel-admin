# Admin threat model

[English](threat-model.md) · [فارسی](threat-model.fa.md)

Assets include in-memory bearer credentials, privileged actions, profile data, HTTP responses and future immutable release artifacts. Boundaries separate untrusted browser input, this admin's local HTTP/session owners, the independently authorized API, external media origins and future operator-managed TLS/static hosting. Menus and route metadata are not authorization; the API enforces access.

Preserve safe rendering, runtime validation of critical replies, explicit origins, generation/request-intent guards and privacy-safe errors. Coordinate token/cookie, CSRF/origin and incompatible protocol changes with the API owner. Catalogs are local; language, direction and calendar settings remain server-owned. Browser preferences store only theme/compact choices.

Public build values and synthetic examples cannot contain secrets. Packaging/path validation and Nginx templates reduce specific preparation risks; they do not prove a real build, trusted certificate, secure deployment or secret-free artifact. Future operator execution requires its own authorization and evidence.

Current tests use isolated synthetic data and complete mocks. Databases, uploads, real environments and production are outside fixtures. Record each control's source/tests and residual risk; do not describe desired rotation, distributed rate limits, recovery or deployment hardening as already implemented.

See [security reviews](reviews.md), [reporting](../../SECURITY.md), [HTTP ownership](../http-client.md) and [deployment preparation](../deployment.md).
