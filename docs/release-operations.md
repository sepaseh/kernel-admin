# Release operations and rollback

[English](release-operations.md) · [فارسی](release-operations.fa.md)

Read the checked revision's [publication policy](../.github/bootstrap-policy.json), [source inventory](bootstrap.md) and [canonical gate](../.agents/validation.json) to identify admitted release helpers and application checks. Source admission, an executed build and a deployment are distinct claims. Record their actual evidence separately; no source declaration authorizes contact with a real target.

For an authorized release, record the exact source revision, locked dependencies, public API origin/base path and immutable ID. Build with that identity, inspect the resulting metadata, then package once into new output. Keep the artifact and hashes; neither a synthetic fixture nor a configuration file is a released version.

Prepare a new operator-owned release directory or exact image tag. Validate Nginx/TLS and the intended release before an atomic switch, then perform authorized readiness/smoke checks. For rollback, select the previously verified compatible artifact and recheck identity after switching. Do not rebuild changed public configuration under an old ID. Preserve the failed artifact and first error for investigation.

No frontend rollback can reverse an API migration or restore API data. This repository owns no server database/uploads. Keep API compatibility and data operations with their separate owner, and never contact a real target or change hosting without explicit authorization.

Read [deployment](deployment.md), [version preparation](releasing.md) and [recovery](backup-restore.md).
