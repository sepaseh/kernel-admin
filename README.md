# Kernel Admin

A standalone React/Vite TypeScript administration panel using Ant Design, React Router and Axios. Developers choose a compatible backend for authentication, authorization, data and storage.

## Start here

| Your goal                 | Guide                                           |
| ------------------------- | ----------------------------------------------- |
| Install and run the panel | [Run and configure](docs/usage.md)              |
| Explore what is included  | [Included capabilities](#included-capabilities) |
| Work with the source      | [Develop a feature](docs/development.md)        |
| Deploy the application    | [Build, package and deploy](docs/deployment.md) |

Local setup requires the Node version in [`.nvmrc`](.nvmrc) and its bundled npm. Opening the panel also requires a backend compatible with the local [HTTP contracts and examples](docs/authentication.md#backend-integration). The [run guide](docs/usage.md) covers installation, public configuration and the first sign-in. Builds and synthetic source checks need no live backend; [testing](docs/testing.md) describes their fixtures.

## Included capabilities

- Sign-in, registration, password recovery and account/profile editing.
- User management, role assignments and role permissions.
- Global settings, appearance and logo uploads.
- Calendar screen.
- Ten UI languages, RTL/LTR layouts, API-selected calendars, light/dark themes
  and compact mode.

Available routes and actions depend on the account's backend-assigned permissions.
The backend supplies application data and enforces authorization.

## Work with the source

Follow [development](docs/development.md) to change a feature, [testing](docs/testing.md)
to cover its behavior and [validation](docs/validation.md) to check a proposed change.
The [architecture guide](docs/architecture.md) explains the application structure.

## Project boundaries

Keep this repository as one root frontend project. API language, direction and calendar drive the interface; theme and compact mode are browser preferences. English repository documentation does not change the application's supported translations.

Use the [documentation map](docs/README.md) for focused references, [Contributing](CONTRIBUTING.md) for the change workflow and [Security](SECURITY.md) for private reporting. Assistants start with [AGENTS](AGENTS.md).

## Deploy the application

Follow [build, package and deploy](docs/deployment.md) to create a release and
choose [Docker](deploy/docker/README.md) or [native Nginx](deploy/native/README.md)
hosting. The guide covers configuration, health checks and rollback.
