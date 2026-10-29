# Authorized target verification preparation

[English](staging.md) · [فارسی](staging.fa.md)

[Target validators](../scripts/validate-workflow-targets.mjs) and synthetic tests are published prerequisites. They check explicit host matching, credential-free URLs and, for smoke inputs, matching immutable expected release identity. DAST input validation also rejects the configured production host. These checks inspect supplied values; they do not authorize a request, establish DNS/redirect safety or prove a deployed service.

Check [the publication policy](../.github/bootstrap-policy.json) and [validation manifest](../.agents/validation.json) before assuming a staging, smoke or DAST workflow/browser suite is admitted. While `applicationReady` is false, prerequisite source cannot establish a deployed application. A true readiness declaration or admitted job still does not authorize a target: real testing needs a deployed compatible application and explicit authorization covering that target and operation. Neither source admission nor dispatch alone proves success.

For future operation, record the approved application/API hosts, health URLs, release ID, allowed scope, credentials handling and cleanup/retention plan. Validate those explicit values before any network activity. Never infer approval from a public example or discover a target by reading operator state. Keep synthetic tests independent of production.

After implementation, record the actual workflow revision, target scope, first failure and observed result. A passing local validator or a configured repository variable is not a completed staging test.

Read [deployment](deployment.md), [security](../SECURITY.md) and [test reliability](test-reliability.md).
