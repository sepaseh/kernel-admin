# Validate a source change

Use the [publication policy](../.github/bootstrap-policy.json) to identify this snapshot's phase, readiness and admitted files. The [validation manifest](../.agents/validation.json) owns commands, profiles and required checks; [settings](../.agents/settings.json) project that inventory. Run the actual phase's complete `full` gate without claiming unpublished application capabilities.

## Validate the exact proposed source

Use the existing checkout under the [working-checkout rule](../.agents/rules/branches.md#working-checkout). Additional implementation worktrees, clones and copied checkouts require prior explicit authorization. A disposable verification export is evidence only.

1. Select the precise proposed base-to-head snapshot and its admitted files. Record the source commit/tree, selected changes and phase. Preserve bytes and unrelated work; extra unpublished files must not supply missing dependencies to a partial PR.
2. Export that selection under an ignored repository-local directory such as `coverage/validation/`. Keep private operator state out. Direct `TMP`, `TEMP` and `TMPDIR` to an existing ignored scratch directory. Set `GIT_CEILING_DIRECTORIES` to their common verification parent so fixture Git commands cannot discover the implementation repository.
3. Use the Node release pinned in [`.nvmrc`](../.nvmrc) and its bundled npm. From the export root, install locked dependencies with `npm ci --strict-peer-deps --no-audit --no-fund`. Install the browsers required by that phase before its browser checks.
4. In that verification session, use explicit synthetic public inputs:

   ```powershell
   $env:KERNEL_SYNTHETIC_ENV = "1"
   $env:STORYBOOK_DISABLE_TELEMETRY = "1"
   $env:VITE_API_BASE_URL = "https://api.example.com"
   $env:VITE_APP_BASE_URL = "/"
   $env:VITE_OBSERVABILITY_URL = ""
   $env:VITE_RELEASE_ID = "application-verification"
   npm run validate -- full
   ```

   These inputs prevent ambient operator environment discovery where supported and identify synthetic verification. The release label is not an application-readiness claim. Never load a real environment as a fixture.

5. Preserve the first failure and resolve it within scope. Revalidate changed source. Do not omit required files or checks, suppress findings, lower coverage or tolerances, or weaken security controls to obtain a pass.
6. Verify that maintained source stayed unchanged. Record actual execution, the checked tree and material limitations in the handoff. Keep generated evidence in ignored repository-local directories.

A complete local pass applies only to that exact snapshot and phase. It does not establish hosted provider results, an assembled application, deployment, production access or human visual approval.

## Hosted checks and review

Protected `main` retains these five provider-bound contexts: `check`, `PR file limit`, `SonarQube Cloud analysis`, `SonarCloud Code Analysis` and `CodeRabbit`. Keep strict up-to-date checks, one native approving review, stale-review dismissal, resolved conversations, linear history, administrator enforcement, and blocked force pushes/deletions. Verify live protection and provider application bindings; a declaration is not proof of server enforcement.

Before an authorized review request or merge:

1. Bind all evidence to the latest published PR head and applicable Sonar project/report. Check native CI, the actual scanner execution and the provider's asynchronous quality gate separately. Missing, pending, failed, stale, skipped or quota-limited results are not completed verification.
2. Before requesting CodeRabbit, every applicable non-CodeRabbit required check must have passed. Inspect every page of the complete applicable unresolved Sonar report across severities and existing/new code; it must contain zero issues. A passing quality gate, zero new issues or an unanalysed project does not establish that result. An open finding classified only in prose still blocks the request.
3. Request one manual `@coderabbitai review` only after that preflight and authorization covering the review request. PR creation does not authorize this request. Respect actual provider capacity and an existing in-flight request. A new commit requires fresh preflight.
4. Inspect CodeRabbit's actual review and disposition. Its successful status can mean a skipped or rate-limited review, and the native one-review count can be satisfied by another reviewer. Preserve the configured author-approval restriction. Never describe status alone as CodeRabbit approval.
5. Merge only with separate authorization, successful current-head required checks, the required approving review and resolved conversations. Do not bypass protection to complete the sequence.

Keep Sonar project binding and source scope accurate. The scanner imports genuinely measured LCOV from the same tested revision and reports only that scope. Scanner execution and the quality gate are separate results. Inspect secret names only during setup; never read or print token values. Provider classification requires its own authorization; do not replace real fixes with exclusions or suppressions.

## Bootstrap PR file limit

The first PR cannot use a trusted default-branch guard before that workflow has entered `main`. Its temporary, read-only `PR file limit` job is restricted to the declared initial base and the PR's verified current head. It counts the real GitHub changed-file entries and cannot approve, merge or write repository contents.

Remove that temporary job in PR 2. The normal [PR policy workflow](../.github/workflows/pr-policy.yml) uses `pull_request_target` with trusted default-branch code pinned to `github.workflow_sha`. It must never execute unreviewed PR head or base code in that context.

That trusted guard becomes available after PR 1 is merged through its required review process. Later stacked PRs may retain a pending `PR file limit` context until then. Pending protection is a dependency to resolve, not permission to bypass the requirement. Initial PRs target at most 80 changed-file entries with 20 reserved for fixes under the hard 100-entry maximum.
