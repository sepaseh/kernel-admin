# Develop a change

Use the existing checkout under the [working-checkout rule](../.agents/rules/branches.md#working-checkout). Inspect its branch, Git status, index and relevant diffs before editing. Preserve unrelated tracked, staged and untracked work.

## Prepare the root toolchain

Install the Node version in [`.nvmrc`](../.nvmrc) and use its bundled npm. From the repository root in PowerShell, install exactly the locked dependencies:

```sh
npm ci --strict-peer-deps --no-audit --no-fund
```

The command should finish without dependency or peer-resolution failures. Resolve runtime or lockfile mismatches before running checks. Do not replace locked installation with unreviewed dependency updates.

Keep one standalone root npm project. Do not add workspaces, local-package links, backend SDKs or source dependencies on another checkout. The consuming developer chooses a backend implementing the local HTTP contract.

## Find the current owner

Read [the publication policy](../.github/bootstrap-policy.json), [task map](../.agents/navigation.json), owning source and nearby tests. The policy is the exact admitted inventory. Plain paths to application owners in instructions express constraints for their admission; they do not make the application available.

Repository publication and CI policy belong to [the snapshot validator](../scripts/validate-bootstrap.mjs) and [CI checker](../scripts/check-ci.mjs). Assistant guidance belongs to [settings](../.agents/settings.json), [the guidance checker](../scripts/check-guidance.mjs) and existing guides. [The manifest](../.agents/validation.json) owns commands and profiles.

## Change and verify the behavior

Define the observable result and the failure it must handle. Change its owning source and retain meaningful positive and negative regressions. Synthetic fixtures must be disposable and independent of real environments, credentials, databases, uploads, browser profiles or operator services.

Run the smallest relevant check first. Guidance iteration uses:

```sh
npm run validate -- guidance
```

Read the actual result and diagnostics. Numerical coverage, duplication and analyzer metrics are advisory; retain behavioral assertions, type safety, lint and security controls. [Testing](testing.md) explains available evidence, and [validation](validation.md) defines the complete gate before an authorized commit or publication.

When application modules are admitted, keep feature APIs, wire types, forms and tests with their feature. Preserve memory-only tokens, session generations, bounded shared refresh, cancellation, stale-result guards, all ten catalogs and Persian calendar data. API metadata owns language, direction and calendar; browser preferences own theme and compact mode.

## Own build artifacts during publication

Run build stamping and release packaging after the builder has stopped. The invoking account must exclusively control the canonical build parent and the helpers' newly created workspace; do not run another builder or publisher against those paths concurrently. These helpers isolate the build entry in a private sibling directory, validate opened file identities, and restore the build after the operation. They are not a sandbox for other processes running with the same account or holding existing write handles.

If restoration cannot complete because the public build path is occupied, keep the reported recovery directory. Inspect the occupied path and recover the retained build deliberately; the helpers do not recursively delete build contents to force restoration. After an interrupted process, inspect `.kernel-build-*/build` or `.kernel-release-*/build` beside the original build path. Restore the retained directory only after confirming the original path is free and its publisher has stopped.

## Update the owning guide

Update the existing guide with behavior or procedure changes. Keep prose English and task-oriented. [Contributing](../CONTRIBUTING.md) owns publication and review boundaries. Keep scratch exports, generated evidence and recovery files in ignored repository-local directories; never use them as implementation checkouts.
