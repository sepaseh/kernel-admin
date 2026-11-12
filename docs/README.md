# Documentation

Choose a guide by the result you need. Commands run from the repository root unless a guide explicitly says otherwise.

## Complete a task

| Goal                        | Guide                                      | What it covers                                            |
| --------------------------- | ------------------------------------------ | --------------------------------------------------------- |
| Open the panel locally      | [Run Kernel Admin](usage.md)               | Prerequisites, public configuration, startup and recovery |
| Implement a feature change  | [Develop a feature](development.md)        | Source owners, interaction contracts and focused checks   |
| Validate proposed source    | [Validate a change](validation.md)         | Check profiles, synthetic setup and publication evidence  |
| Build and operate a release | [Build, package and deploy](deployment.md) | Immutable artifacts, hosting, target checks and rollback  |

## Find a contract or source owner

| Question                                          | Reference                                                  |
| ------------------------------------------------- | ---------------------------------------------------------- |
| Where does a behavior belong?                     | [Source navigation](source-navigation.md)                  |
| How do startup, providers and routes fit?         | [Application architecture](architecture.md)                |
| How do sessions, requests and stale results work? | [Authentication and request lifecycles](authentication.md) |
| Who chooses language, direction and calendar?     | [Localization](localization.md)                            |
| How should a behavior be tested?                  | [Testing](testing.md)                                      |
| Which preserved source changes need discussion?   | [Source-change requests](source-change-requests.md)        |
| What makes an interface change complete?          | [Design conventions](../DESIGN.md)                         |
| How should a vulnerability be reported?           | [Security policy](../SECURITY.md)                          |

## Maintain the documentation

Follow the [documentation workflow](../CONTRIBUTING.md#documentation) when behavior, configuration or verification changes. Update the existing owner guide and link it here when its purpose changes. Keep commands and configuration tied to their declared source owners.

[Instruction discovery evaluation](comprehension-evaluation.md) is an optional read-only assessment for maintainers of assistant guidance.

Documentation describes current source and procedures. Test configuration, examples and available commands do not establish an executed deployment or provider verification.
