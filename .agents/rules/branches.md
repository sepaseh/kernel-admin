# Branches

Use a short purpose-based name. The default is `codex/<short-kebab-purpose>`;
include a verified issue number when it helps identify the work. An explicit
user-requested name takes precedence. Do not encode mutable labels, priority or
assignee metadata in the name.

- Reuse a current branch that already represents the requested work.
- Before creating or switching branches, inspect the current branch, working
  tree and staged changes. Preserve unrelated tracked and untracked work.
- Start from the intended base verified from the user's request or repository
  metadata; do not assume a branch name or silently discard local changes to
  reach it. An unborn repository has no committed base: report that fact and
  preserve its working tree rather than inventing history.
- Branch changes must be authorized by the task. Do not rename/delete a
  published branch or rewrite history without explicit authorization and
  coordination with affected review requests.

Use [Git workflow](git.md) for action boundaries and [commits](commits.md) for
commit naming. Branch preparation does not authorize a commit or push.
