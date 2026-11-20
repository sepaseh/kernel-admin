# Kernel Admin

Kernel Admin is the standalone administration frontend for a compatible HTTP
API. It uses React, TypeScript, Vite, Ant Design, React Router and Axios.
The backend supplies authentication, authorizes operations and stores data.

## Run locally

Use the Node version pinned in [`.nvmrc`](.nvmrc) and its bundled npm. For sign-in, you also need the address of a compatible API and an account on that service. [Backend integration](docs/authentication.md#backend-integration)

1. Install dependencies from the repository root.

   ```sh
   npm ci --strict-peer-deps --no-audit --no-fund
   ```

2. Create `.env.local` from the public example if you have no local configuration. Set `VITE_API_BASE_URL` to your API address and use `/` for `VITE_APP_BASE_URL` in this quick start. Configure the API to allow the frontend origin `http://127.0.0.1:5173` with credentials. [Public example](.env.example) · [Local configuration and troubleshooting](docs/usage.md)

3. Start the installed Vite server.

   ```sh
   npm exec --no -- vite --host 127.0.0.1 --port 5173 --strictPort
   ```

4. Open the sign-in page. The form appears after the frontend loads public settings from the API. [Local sign-in](http://127.0.0.1:5173/auth)

Storybook uses synthetic fixtures so you can explore the components without a running backend. [Test components in Storybook](docs/testing.md#test-components-in-storybook)

## Included capabilities

- Sign-in, registration, password recovery and account management.
- User management, role assignments and role permissions.
- Content, content categories and frequently asked questions.
- Global settings, appearance and logo uploads.
- Calendar and file-management screens.
- Ten UI languages, RTL/LTR layouts, API-selected calendars, light/dark themes
  and compact mode.

Available routes and actions depend on the account's backend-assigned permissions.
The backend supplies application data and enforces authorization.

## Documentation

- [Documentation index](docs/README.md) for guides by task.
- [Architecture](docs/architecture.md) for system boundaries and source ownership.
- [Development](docs/development.md) for local setup and source changes.
- [Validation](docs/validation.md) for required checks and evidence.
- [Deployment](docs/deployment.md) for packaging and deployment.

## Get help and contribute

Use repository issues for bugs and feature requests. Report suspected
vulnerabilities privately. [Issues](https://github.com/sepaseh/kernel-admin/issues) · [Security policy](SECURITY.md)

Follow the contribution workflow to propose a change. Assistants start at the
repository's assistant entry point. [Contributing](CONTRIBUTING.md) · [Assistant entry point](AGENTS.md)
