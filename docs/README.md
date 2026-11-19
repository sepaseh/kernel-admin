# Documentation

Commands run from the repository root unless a guide explicitly says otherwise.

## 1. Install and run

Follow [Run Kernel Admin](usage.md) for prerequisites, locked dependency installation, public configuration, local startup and recovery.

## 2. Explore the application

Read the [included capabilities](../README.md#included-capabilities) for the available screens and features. The [architecture](architecture.md) explains startup, providers, routes and feature boundaries.

## 3. Work with the source

Start with [Develop a feature](development.md) to find the owning implementation, change its contract and interaction, and select focused checks.

| Task                                       | Guide                                                      |
| ------------------------------------------ | ---------------------------------------------------------- |
| Change sessions, requests or stale results | [Authentication and request lifecycles](authentication.md) |
| Change language, direction or calendar     | [Localization](localization.md)                            |
| Add behavioral tests                       | [Testing](testing.md)                                      |
| Verify proposed source                     | [Validate a change](validation.md)                         |
| Change an interface                        | [Design conventions](../DESIGN.md)                         |
| Prepare a contribution                     | [Contributing](../CONTRIBUTING.md)                         |
| Report a vulnerability                     | [Security policy](../SECURITY.md)                          |

Follow the [documentation workflow](../CONTRIBUTING.md#documentation) alongside behavior, configuration or verification changes. Update the existing guide and link to configuration and command owners.

## 4. Package and deploy

Follow [Build, package and deploy](deployment.md) for immutable release artifacts, hosting configuration, authorized target checks and rollback.
