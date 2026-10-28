# Change handoff and implementation plan

[English](change-workflow.md) · [فارسی](change-workflow.fa.md)

Use this handoff for a feature, defect or operational change. The current
`assistant-guidance` phase remains non-runnable; an operational proposal does not
publish deployment tooling. This procedure adds no AI runtime and requires no
particular assistant. Keep the filled record with the issue,
PR or local task evidence; creating remote issues or sending messages requires
the owner's authorization.

## Establish the change contract

- Record the request, its source and date. Mark each item as required, proposed,
  conditional or out of scope. A learning-roadmap topic is not automatically a
  product requirement.
- Name the owning standalone repository/source module and affected HTTP consumers. Contracts and
  catalogs are independently owned local copies. Coordinate observable HTTP
  compatibility when needed; do not impose synchronized catalog edits.
- Read the matching [task navigation](source-navigation.md), owner source,
  contracts, rules and tests. Record current behavior and the concrete failure.
  Include dirty/untracked source in the baseline; exclude real env/state/secrets.
- Write numbered acceptance scenarios before editing: trigger, observable result,
  failure/authorization boundary and verification evidence. Cover relevant session
  races, language/cache/privacy, transactions or recovery as part of that scenario.

## Reusable task record

Copy and fill this record; do not retain example placeholders as completed evidence.

```text
Request/source/date:
Required items and explicit exclusions:
Owner and affected consumers:
Baseline / changed source scope:
R1: Given ... when ... then ...; verify with ...
R2: Invalid/stale/unauthorized ... must ...; verify with ...
Dependencies or operator decisions still needed:
Implementation steps (small, ordered, with owning files):
Data/migration/contract compatibility and rollback:
Synthetic fixtures, resources and cleanup:
Validation IDs/profile from .agents/validation.json:
Manual checks / external services not run:
Observed results, failures and skips:
Remaining recommendations and owner:
```

Prefer the smallest coherent implementation. Keep backend behavior in its owning
API, frontend presentation in its app, and product/provider integrations conditional
on an actual requirement. Add a short ADR when a durable architectural decision
changes. Update the matching English/Persian explanation in the same change.

Use the canonical [validation policy](validation.md) for commands rather than
copying another full gate. Report implemented code, configured workflows, executed
tests and unexecuted manual checks separately. Review failures using
[testing guidance](testing.md). Do not claim a manual screen-reader review,
hosted CI, production recovery or an assistant benchmark from source inspection.
Commit, push and production access retain their existing authorization boundaries.
