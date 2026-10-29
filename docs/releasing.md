# Versioning and release preparation

[English](releasing.md) · [فارسی](releasing.fa.md)

Use Conventional Commits, a coherent reviewed PR and the [branch policy](branch-protection.md). Authorized PRs are published Ready for review. Read admitted release/build sources and `applicationReady` from [the publication policy](../.github/bootstrap-policy.json); a version declaration cannot activate unpublished capabilities.

The published `release-please-config.json` and `.release-please-manifest.json` describe version preparation for the standalone root package. Their version value is configuration, not proof of a tag, changelog, released artifact or hosted execution. Check the admitted inventory before assuming a release workflow exists; even an admitted workflow needs a real authorized run before its result can be claimed.

Before a future automated release, publish and review the workflow, immutable action pins, permissions and default-branch restriction; preserve manual authorization and actual branch protection. Version automation must not imply deployment approval. Add the genuine application build, browser/visual and any release-specific checks before runnable activation.

The [validation manifest](../.agents/validation.json) owns the complete required gate for the declared capability. While readiness is false, pure prerequisites and synthetic fixtures do not establish a runnable release. Claim Pact, mutation, application E2E, reviewed visual comparison, Lighthouse or deployment only when their admitted checks actually ran, and record revision/results and unavailable evidence separately. Packaging must bind an immutable release ID to the same build and public configuration.

See [operations](release-operations.md) and [deployment](deployment.md).
