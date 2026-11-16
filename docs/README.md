# Documentation

Commands run from the repository root unless a guide explicitly says otherwise. [The publication policy](../.github/bootstrap-policy.json) defines current source admission and readiness; referring to source does not admit it.

## 1. Prepare the toolchain

Follow [Development](development.md) to install the pinned runtime and locked dependencies in the existing checkout.

## 2. Understand the current scope

Read [the application scope](../README.md#application-scope). Installation, features and deployment require their source and commands to be admitted first. Design and application rules define constraints for that work without implying a runnable application.

## 3. Work with the source

| Task                                              | Guide                                                   |
| ------------------------------------------------- | ------------------------------------------------------- |
| Make a source or guidance change                  | [Development](development.md)                           |
| Understand synthetic test evidence                | [Testing](testing.md)                                   |
| Validate an exact proposed snapshot               | [Validation](validation.md)                             |
| Design an admitted interface or requested concept | [Design conventions](../DESIGN.md)                      |
| Prepare a contribution                            | [Contributing](../CONTRIBUTING.md)                      |
| Evaluate instruction discovery when requested     | [Comprehension evaluation](comprehension-evaluation.md) |
| Report a vulnerability                            | [Security policy](../SECURITY.md)                       |

Assistants start with [AGENTS](../AGENTS.md). Keep documentation English, current and organized by task. Follow the [documentation workflow](../CONTRIBUTING.md#documentation).

## 4. Package and deploy

Deployment requires admitted build and hosting owners, successful verification and explicit target authorization. Guidance, dependency installation and optional hooks do not establish deployment or authorize an operational environment.
