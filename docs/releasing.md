# Versioning and release preparation

[English](releasing.md) · [فارسی](releasing.fa.md)

Use Conventional Commits, a coherent reviewed PR and the [branch policy](branch-protection.md). Authorized PRs are published Ready for review. The current phase remains non-runnable.

The published `release-please-config.json` and `.release-please-manifest.json` describe future version preparation for the standalone root package. Their version value is configuration, not proof of a tag, changelog, released artifact or hosted execution. No release-please workflow is published in this phase, and it must not be advertised as runnable.

Before a future automated release, publish and review the workflow, immutable action pins, permissions and default-branch restriction; preserve manual authorization and actual branch protection. Version automation must not imply deployment approval. Add the genuine application build, browser/visual and any release-specific checks before runnable activation.

The current twelve-check [full gate](validation.md) measures published source, including pure prerequisites and synthetic fixtures. It does not execute Pact, mutation, application E2E, visual comparison, Lighthouse or deployment. Record actual revision/results and unavailable checks separately. Future packaging must bind an immutable release ID to the same build and public configuration.

See [operations](release-operations.md) and [deployment](deployment.md).
