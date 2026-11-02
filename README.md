# Kernel Admin

Kernel Admin is a standalone React, TypeScript and Ant Design admin frontend being published through a sequence of reviewed pull requests.

This snapshot contains the capabilities admitted by the [publication policy](.github/bootstrap-policy.json). Its `phase`, `applicationReady` and exact inventory describe the current source. Until application readiness is true and its required checks have actually passed, the snapshot does not establish an assembled application, a production build or a deployed service.

Current publication phase: `ui-foundation`. Application readiness: `false`. This phase adds shared UI controls, theme and browser-preference helpers, guarded mutation hooks, observability and licensed local assets to the existing HTTP/session lifecycles, all ten language catalogs and date adapters, including Persian calendar data.

Start with [Contributing](CONTRIBUTING.md) for the Git and review workflow, [development](docs/development.md) for source changes, [validation](docs/validation.md) for the exact required gate and the [documentation map](docs/README.md) for the current guides.

Every change to protected `main` goes through a PR. Before opening a PR, aim for at most 80 changed-file entries initially, split independent changes when useful and explain larger cohesive scopes. File count is advisory: exceeding 100 files alone does not fail CI or require recreating a PR. CodeRabbit and Sonar requirements remain mandatory; a configured provider is not evidence of a completed review or analysis.

The project uses one root package and the Node version pinned in [`.nvmrc`](.nvmrc). Install the locked dependencies with `npm ci --strict-peer-deps --no-audit --no-fund` before running the phase's declared checks. Run commands from the repository root and use synthetic inputs rather than private operator state.

Application run and deployment instructions belong with the phases that admit their complete source and verification. No backend source checkout is required to validate the frontend's local contracts.
