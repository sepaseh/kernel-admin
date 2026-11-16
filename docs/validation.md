# Validate a source change

Use this guide to prepare evidence for an authorized commit or PR. [The publication policy](../.github/bootstrap-policy.json) defines exact admitted files, phase and `applicationReady`. [The validation manifest](../.agents/validation.json) owns commands, required kinds and profiles; [settings](../.agents/settings.json) project that inventory.

## Choose a profile

| Need                                   | Profile    | What it establishes                             |
| -------------------------------------- | ---------- | ----------------------------------------------- |
| Iterate on documentation or guidance   | `guidance` | Guidance consistency and focused regressions.   |
| Prepare an exact proposed commit or PR | `full`     | Every required check for the actual phase.      |
| Recheck the complete phase selection   | `complete` | The complete selection for admitted capability. |

Use the Node version in [`.nvmrc`](../.nvmrc) and its bundled npm. Install locked dependencies before a check. From the repository root:

```sh
npm run validate -- guidance
```

The runner names each check and returns nonzero on failure. Advisory classification does not turn a failure into a pass. A repository-only profile does not establish application build, browser, visual, provider or deployment results.

## Validate the exact proposed source

Implement in the existing checkout under [the working-checkout rule](../.agents/rules/branches.md#working-checkout). A disposable export is verification-only, stays in ignored repository-local storage such as `coverage/validation/`, and must never become another implementation checkout.

1. Select the exact proposed snapshot. Read its actual phase, readiness and allowed files from the publication policy. Record source commit/tree and included changes in the chat or authorized PR materials. Export only that selection, preserving bytes and excluding private, unrelated and operator state.
2. In PowerShell at the export root, create an ignored scratch directory below the common verification parent. Direct `TMP`, `TEMP` and `TMPDIR` there and set `GIT_CEILING_DIRECTORIES` to the verification parent so synthetic fixtures cannot discover the implementation repository through an ancestor. Use public synthetic values:

   ```powershell
   $env:KERNEL_SYNTHETIC_ENV = "1"
   $env:STORYBOOK_DISABLE_TELEMETRY = "1"
   $env:VITE_API_BASE_URL = "https://api.example.com"
   $env:VITE_APP_BASE_URL = "/"
   $env:VITE_OBSERVABILITY_URL = ""
   $env:VITE_RELEASE_ID = "application-verification"
   ```

3. Install locked dependencies and run every required check:

   ```sh
   npm ci --strict-peer-deps --no-audit --no-fund
   npm run validate -- full
   ```

4. Preserve the first failure and diagnostics. Resolve it within scope and reverify. Do not omit required source, assertions, type/lint or security controls to pass. Audit unavailability is a failure. Do not stage, commit or publish while a required check fails or cannot run.
5. Confirm maintained source bytes stayed unchanged. Report the checked snapshot, actual commands/results and evidence limits. Keep generated evidence in ignored repository-local storage.

When production source must remain unchanged, present the exact failing file, trigger, evidence and minimal proposal in the chat or authorized PR materials and discuss the edit first. Honor existing approval for that scope. A failing test alone does not authorize a source rewrite.

## Interpret the evidence

The full profile checks actual admitted source. Unit and governance reports must contain genuine measurements for that snapshot. Application admission requires composition and genuine build, contract, browser and applicable visual checks. Declarations, installed dependencies and configured components cannot replace execution.

Local success does not establish hosted CI, CodeQL, Sonar analysis, approval or deployment. Keep scanner completion separate from its provider quality gate. Preserve source/test analysis and measured coverage inputs. The versioned CPD-only exclusion in [scanner configuration](../sonar-project.properties) disables duplication measurement without excluding source, security analysis or coverage.

## Hosted checks and review

Before an authorized provider-review request or merge, verify latest head/base and applicable live protection. Keep correctness/security checks, scanner execution, one native approving review, stale-approval dismissal, an up-to-date branch, resolved conversations, linear history, administrator enforcement and blocked force pushes/deletions. Do not weaken protection to hide missing evidence.

Follow [CodeRabbit preflight](../.agents/rules/pull-requests.md#coderabbit-request-preflight). All applicable latest-head non-CodeRabbit correctness/security checks and scanner execution must pass first. Numerical metric gates and a zero-issue Sonar report are not prerequisites. Review requests require separate authorization; preserve actual allowance and avoid duplicate in-flight requests. Merging has a separate authorization boundary.

## Review PR scope before opening

Plan for at most 80 GitHub changed-file entries per PR. Before opening a PR or pushing changes, verify the live intended base and count the complete base-to-proposed-head diff, including additions, deletions, renames and binaries; one rename counts once. The mandatory maximum is 100. Recount after scope or base changes and record the count in the PR description.

Split larger work into reviewable PRs. Cohesion and ordinary commit/push authorization do not waive the maximum. An exception requires prior explicit authorization for that specific oversized scope. Discuss an existing oversized PR before further publication; do not silently close/recreate it, rewrite history, remove required source or change its base merely to hide entries.
