---
name: create-pr
description: Prepare or create a focused Kernel pull request with exact-snapshot validation and explicit publication authorization.
---

# Create a pull request

Read [Git workflow](../../rules/git.md), [pull requests](../../rules/pull-requests.md),
[branches](../../rules/branches.md), [commits](../../rules/commits.md) and
[safety](../../rules/safety.md). Use [validate-change](../validate-change/SKILL.md)
for the final gate.

1. Verify repository, current head, live intended base and available host tools.
   Preserve unrelated and unpublished work; a local draft is not remote publication.
2. Before opening a PR or pushing further changes, verify the live intended base
   and count the complete base-to-proposed-head GitHub diff. Plan for at most 80
   changed-file entries; 100 is the mandatory publication maximum. Count
   additions, deletions, renames and binaries; one rename is one entry. Recount
   the whole PR after scope or base changes, not only the latest commit. Split
   work exceeding 100 entries into reviewable PRs, or prepare a concrete scope
   proposal and obtain prior explicit user authorization for that specific
   exception. Cohesion or ordinary commit/push authorization does not waive the
   maximum. Record the count and any approved exception in the PR description.
   Discuss an existing oversized PR before further publication; do not silently
   close/recreate it, rewrite history or remove required source/tests.
3. Read the declared phase, `applicationReady` and exact admitted inventory from
   [the publication policy](../../../.github/bootstrap-policy.json). Run the
   [canonical full profile](../../validation.json) on the exact proposed snapshot
   and record the declaration, revision/tree and actual checks. Retain false
   readiness until authorized application admission and its complete genuine gate
   have passed; never change the declaration to bypass checks. Disclose unpublished
   capabilities and unavailable evidence.
4. Use a Conventional Commit title and the existing PR template. Explain the
   concrete problem, resulting behavior, verification and limitations.
5. Apply authorization and preferences already provided in the conversation. An
   explicit request to publish/create the PR authorizes the necessary branch push;
   do not ask again for an already authorized action. If publication is not
   authorized, prepare the reviewable local result and ask only for the missing
   remote action. Honor an explicit Ready for review preference after required
   local work is complete; otherwise preserve the user's requested draft state.
6. Report the PR URL or local draft and material evidence gaps. PR creation does
   not itself authorize merging, requesting CodeRabbit or changing unrelated
   remote metadata.

Before an authorized CodeRabbit request, complete the canonical
[preflight](../../rules/pull-requests.md#coderabbit-request-preflight): all latest-head
non-CodeRabbit required correctness/security checks and scanner execution pass;
numerical metric gates and a zero-issue Sonar report are not prerequisites.
Respect current allowance and avoid duplicate in-flight requests. A new commit
invalidates preflight; provider classification requires its own authorization.
