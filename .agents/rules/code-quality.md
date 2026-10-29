# Code Quality

## Validate code changes

Run the smallest check that covers the files you changed, then broaden before handoff when practical.

- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Isolated workshop build: `npm run build-storybook`
- Browser interaction/accessibility: `npm run test:storybook`

Select current commands from [the manifest](../validation.json). For guidance-only
iteration, use `npm run validate -- guidance` and check formatting. The focused
profile cannot replace the complete canonical full gate on the exact final snapshot
before an authorized commit, push or PR handoff. The admitted full profile also owns production build, unused-code and genuine performance verification.

## Autofix workflow

- Let ESLint handle import sorting. Check style-object property order directly, as described in [styling](styling.md).
- Use `npm run lint:fix` when safe to auto-fix formatting/lint issues.
- Never sort imports manually if ESLint can do it.
- Do not introduce a formatter or new tooling unless the user asks.

## Readable code over comments

Write self-documenting code. Add comments only for:

- Non-obvious business logic
- Algorithmic decisions that are not clear from the code
- Temporary workarounds with context

## Semantic whitespace

- Treat a blank line as a paragraph boundary between conceptually distinct
  parts of the code, not as decoration between individual statements.
- Leave one blank line after guard clauses before the main execution path.
- Keep consecutive steps of one workflow together, including setup, derived
  values, branching, and their related success effects.
- Add a blank line only when the code changes responsibility or begins an
  independently meaningful phase. If a function needs many such phases,
  consider extracting a focused helper instead of adding more visual sections.
- Apply this to changed handlers, hooks, helpers and tests as well as components;
  arrange/act/assert are useful test phases. Review the semantic grouping directly:
  a formatter passing does not prove that phase boundaries are readable.
- Keep consecutive request steps together, such as setting the busy flag,
  awaiting the request and applying its result. Avoid a new padding rule or
  unrelated formatting sweep to enforce a prose convention.

## Simplicity

- Solve the current task directly; avoid speculative abstractions.
- Keep starter-kit code generic and easy to replace.
- Do not add error handling for impossible states.
- Prefer straightforward repetition over premature abstraction.

## Static-analysis findings

- Treat SonarQube findings as prompts to improve the design, not targets to
  silence mechanically. Understand the reported risk and its runtime context
  before changing code.
- Prefer the simplest idiomatic correction that leaves the code at least as
  readable, cohesive, and type-safe as before.
- Do not introduce wrappers, adapters, `bind` calls, indirection, duplicated
  state, placeholder branches, or speculative abstractions whose only purpose
  is to make an analyzer stop reporting an issue.
- If a clean correction is not possible because the finding is a verified
  false positive, keep the implementation clear and use the narrowest reviewed
  suppression or Quality Profile adjustment. Document why the rule does not
  apply and limit the exception to the affected rule and scope.
- Re-run the analyzer when available, but also review the resulting code on its
  own merits. A passing quality gate does not justify a maintainability
  regression.

## No unused code

- Remove unused files, exports, dependencies, translations, and routes.
- Review unused code with the published type, lint, boundary and admitted unused-code
  checks. Report actual execution from the complete application manifest.
