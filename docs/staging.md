# Authorized target verification preparation

[English](staging.md) · [فارسی](staging.fa.md)

[Target validators](../scripts/validate-workflow-targets.mjs) and synthetic tests are published prerequisites. They check explicit host matching, credential-free URLs and, for smoke inputs, matching immutable expected release identity. DAST input validation also rejects the configured production host. These checks inspect supplied values; they do not authorize a request, establish DNS/redirect safety or prove a deployed service.

The actual staging, smoke and DAST workflows/browser suites are deferred. No such job is installed, dispatched or claimed to pass in this phase. The current application is not assembled; real target testing must wait for runnable activation and explicit authorization covering the target and operation.

For future operation, record the approved application/API hosts, health URLs, release ID, allowed scope, credentials handling and cleanup/retention plan. Validate those explicit values before any network activity. Never infer approval from a public example or discover a target by reading operator state. Keep synthetic tests independent of production.

After implementation, record the actual workflow revision, target scope, first failure and observed result. A passing local validator or a configured repository variable is not a completed staging test.

Read [deployment](deployment.md), [security](../SECURITY.md) and [test reliability](test-reliability.md).
