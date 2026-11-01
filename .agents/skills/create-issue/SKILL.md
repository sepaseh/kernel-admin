---
name: create-issue
description: Draft or publish an actionable Kernel GitHub issue.
---

# Create an issue

Read `.agents/rules/issues.md` when it exists, plus `.agents/rules/git.md` and
`.agents/rules/safety.md`. An issue is a durable handoff, not a transcript.

1. Confirm the repository and available host integration. Inspect relevant code,
   docs, tests and authorized open/closed issue metadata for duplicates; do not
   guess labels or template paths when access is unavailable.
2. State observed facts, expected outcome, impact, evidence, and objective verification.
3. Keep one issue focused on one independently verifiable outcome. Exclude credentials, tokens, personal data, and production payloads.
4. For draft-only work, return the proposed title and body locally. Create a GitHub issue only with explicit authorization.
5. Issue creation does not authorize implementation, comments on a duplicate,
   assignment, labels or project-status changes beyond the requested action.
