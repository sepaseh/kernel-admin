---
name: validate-change
description: Select Kernel checks for the actual change and run the complete canonical gate before an authorized commit, push or PR handoff.
---

# Validate a change

Read the [publication policy](../../../.github/bootstrap-policy.json) for the
phase, readiness and admitted files. Read the affected source, tests and rules.
Inspect the working tree and staged changes under the
[working-checkout rule](../../rules/branches.md#working-checkout).

## Choose affected checks

Start with the smallest relevant published check from the
[validation manifest](../../validation.json). Add a focused regression for
changed observable behavior under the [testing rules](../../rules/testing.md).

Start with typecheck and lint for TypeScript changes or the `guidance` profile
for instructions. See [profile selection](../../../docs/validation.md#choose-a-profile)
for ordinary Chromium checks, the full browser matrix and approved image comparison.

## Validate the exact tree

Record the proposed revision and tree. Before an authorized commit, push or PR
handoff, run `npm run validate -- full` on a fresh verification-only export of
the exact proposed snapshot. Follow the
[exact-source procedure](../../../docs/validation.md#validate-the-exact-proposed-source)
for locked dependencies, synthetic inputs and browsers. In `full`, the
`guidance` entry checks the instructions directly and the governance coverage
suite runs the `guidance-tests` regression files once.

Preserve the first failure. Use
[code quality](../../rules/code-quality.md#static-analysis-findings) to interpret
analyzer findings.

Resolve required failures within the task's scope and reverify. Preserve
required checks, genuine failing assertions and coverage. Leave staging and
committing pending while a required check fails or cannot run.

## Report evidence

Report the phase, readiness, checked revision or tree, commands, actual results
and unavailable checks. Use the
[provider evidence rules](../../rules/pull-requests.md#provider-evidence-and-required-checks)
for hosted checks and approval, and the
[guidance evidence rules](../../rules/guidance.md) for instruction discovery.

Identify any unavailable deployment evidence separately.
