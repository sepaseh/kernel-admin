# Static artifact recovery

[English](backup-restore.md) · [فارسی](backup-restore.fa.md)

This is an operator procedure, not an executed restore report. Read admitted packaging/build capabilities and `applicationReady` from [the publication policy](../.github/bootstrap-policy.json), and required checks from [the manifest](../.agents/validation.json). While readiness is false, prerequisite fixtures cannot establish a recoverable production artifact; even a runnable declaration does not authorize reading backups or operating a target.

After authorized activation, retain immutable public artifacts, release manifests, public build configuration and rendered-configuration provenance. Keep certificates and keys under a separate secure operator backup policy, outside Git and public release archives. Record revision, artifact hash, release ID, base path and API compatibility so recovery selects the original artifact rather than rebuilding different bytes under its old identity.

Recover into a new verified release directory, validate configuration and TLS, switch the release atomically, then check HTML and release identity against the authorized target. Preserve the previous verified version until recovery is confirmed; record failures and cleanup outcomes. A fixture-based packaging test does not prove a real backup is restorable.

This admin contains no server database or upload store. API backups, migrations and data rollback belong to the independent API owner. Never move or reset its state during frontend recovery. Browser preferences and session invalidation are governed by the client, not a server backup.

See [deployment](deployment.md) and [rollback](release-operations.md).
