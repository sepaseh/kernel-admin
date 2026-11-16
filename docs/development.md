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

## Update the owning guide

Update the existing guide with behavior or procedure changes. Keep prose English and task-oriented. [Contributing](../CONTRIBUTING.md) owns publication and review boundaries. Keep scratch exports, generated evidence and recovery files in ignored repository-local directories; never use them as implementation checkouts.
