# Kernel Admin

Kernel Admin is a standalone frontend project. This snapshot publishes repository guidance, contribution policy and their verification toolchain. The [publication policy](.github/bootstrap-policy.json) identifies the exact admitted files and whether application composition is available.

## Start here

| Your goal                   | Guide                              |
| --------------------------- | ---------------------------------- |
| Prepare the local toolchain | [Development](docs/development.md) |
| Understand available checks | [Testing](docs/testing.md)         |
| Validate a proposed change  | [Validation](docs/validation.md)   |
| Contribute or publish a PR  | [Contributing](CONTRIBUTING.md)    |
| Find assistant instructions | [Assistant entry point](AGENTS.md) |

Use the Node version in [`.nvmrc`](.nvmrc) and its bundled npm. Run these commands from the repository root in PowerShell:

```sh
npm ci --strict-peer-deps --no-audit --no-fund
npm run validate -- guidance
```

A successful focused check verifies published guidance. Application installation, browser journeys and deployment require their source, commands and genuine checks to be admitted first.

## Application scope

Keep one root frontend project using React/Vite, Ant Design, React Router and Axios. A consuming developer chooses a backend implementing the local HTTP contract. Application admission preserves memory-only tokens, session generations, bounded shared refresh, cancellation, stale-result guards, all ten catalogs and Persian calendar data. API metadata owns language, direction and calendar; browser preferences own theme and compact mode.

## Review and safety

Publish every change to `main` through a feature branch and PR. Plan for at most 80 changed-file entries per PR and verify the mandatory maximum of 100 against the complete live base-to-head diff. Native approval, provider review, scanner execution and merge authorization remain separate requirements.

Keep real environments, credentials, databases, uploads and browser state out of source and fixtures. Read [Security](SECURITY.md) for vulnerability reporting and the [documentation map](docs/README.md) for current guides.
