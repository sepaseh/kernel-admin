# Kernel Admin

A standalone React/Vite TypeScript administration panel using Ant Design, React Router and Axios. It provides account, user, role, settings and calendar screens. Developers choose a compatible backend for authentication, authorization, data and storage.

## Start here

| Your goal                  | Guide                                           |
| -------------------------- | ----------------------------------------------- |
| Open the panel locally     | [Run and configure](docs/usage.md)              |
| Change a screen or feature | [Develop a feature](docs/development.md)        |
| Check a proposed change    | [Validate a change](docs/validation.md)         |
| Prepare a hosted release   | [Build, package and deploy](docs/deployment.md) |

Local setup requires the Node version in [`.nvmrc`](.nvmrc) and its bundled npm. Opening the panel also requires a backend compatible with the local [HTTP contracts and examples](docs/authentication.md#backend-integration). The [run guide](docs/usage.md) covers installation, public configuration and the first sign-in. Builds and synthetic source checks need no live backend; [testing](docs/testing.md) describes their fixtures.

The [publication policy](.github/bootstrap-policy.json) declares the `application-verification` phase and its admitted source. Provider compatibility and deployed availability require results from the selected target.

## Project boundaries

Keep this repository as one root frontend project. API language, direction and calendar drive the interface; theme and compact mode are browser preferences. English repository documentation does not change the application's supported translations.

Use the [documentation map](docs/README.md) for focused references, [Contributing](CONTRIBUTING.md) for the change workflow and [Security](SECURITY.md) for private reporting. Assistants start with [AGENTS](AGENTS.md).
