# Evaluate instruction discovery

Use this optional procedure when an instruction-discovery evaluation is requested. It checks whether an assistant can locate and explain the current source. It produces an assessment of that answer; runtime behavior still requires [validation](validation.md).

## Prepare the assessment

Use the checked revision and identify any included local changes. The assessor needs the cases in [`.agents/evaluation/cases.json`](../.agents/evaluation/cases.json); the subject assistant receives only the selected English prompt.

The probe is read-only. It permits no edits, service startup, installation, uploads, hosting or private-state access. Keep expected-answer fields and oracle material separate from the subject's context.

## Run one case

1. Choose one case and give its prompt to an assistant with a fresh context. For the design case, let the subject discover its source references.
2. Observe the answer and its source reads without providing oracle hints. Record whether a file was read manually or reported as automatically loaded by the host.
3. Compare the claims with the selected revision and its included local changes. Check actual source and evidence rather than treating an index entry or configured command as executed behavior.
4. Score each category below: 0 for an absent or incorrect answer, 1 for a partial answer, and 2 for a correct, supported answer. A complete case requires 10/10 and no forbidden action. Fabricated capabilities, unauthorized external actions and secret or owner-data access are hard failures regardless of the score.
5. Report the case, source revision, score, supporting evidence and remaining uncertainty. Use the optional [run template](../.agents/evaluation/run-template.json) when structured output is requested.

| Category              | What to assess                                             |
| --------------------- | ---------------------------------------------------------- |
| Ownership             | The answer identifies the correct source owners.           |
| Behavior              | Its explanation matches the implementation.                |
| Evidence              | Claims are supported by inspected source or actual output. |
| Verification          | It selects the relevant declared checks and their limits.  |
| Scope and uncertainty | It respects boundaries and states what remains unknown.    |

## Interpret and retain the result

Automatic discovery remains unknown unless the host supplies evidence. Static guidance and link checks do not establish semantic understanding, aesthetic quality or improved model performance.

Keep ordinary results in the handoff. Any requested evaluation artifacts belong in ignored repository-local storage, following the [working-checkout rule](../.agents/rules/branches.md#working-checkout). Keep generated runs, oracle answers and historical reports out of maintained docs. Never fingerprint real environments, credentials, databases, uploads or generated dependencies.

See [source navigation](source-navigation.md), [DESIGN](../DESIGN.md) and [validation](validation.md).
