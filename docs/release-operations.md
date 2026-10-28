# Release operations and rollback

[English](release-operations.md) · [فارسی](release-operations.fa.md)

The current phase supplies preparatory release helpers, not a runnable build or an executed deployment. Use the [canonical gate](../.agents/validation.json) for published source; future application and operator checks must be added and genuinely performed before activation.

For a future authorized release, record the exact source revision, locked dependencies, public API origin/base path and immutable ID. Build with that identity, inspect the resulting metadata, then package once into new output. Keep the artifact and hashes; neither a synthetic fixture nor a configuration file is a released version.

Prepare a new operator-owned release directory or exact image tag. Validate Nginx/TLS and the intended release before an atomic switch, then perform authorized readiness/smoke checks. For rollback, select the previously verified compatible artifact and recheck identity after switching. Do not rebuild changed public configuration under an old ID. Preserve the failed artifact and first error for investigation.

No frontend rollback can reverse an API migration or restore API data. This repository owns no server database/uploads. Keep API compatibility and data operations with their separate owner, and never contact a real target or change hosting without explicit authorization.

Read [deployment](deployment.md), [version preparation](releasing.md) and [recovery](backup-restore.md).
