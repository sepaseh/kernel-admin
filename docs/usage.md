# Run Kernel Admin

Use this guide to configure the panel and sign in locally. Choose a compatible backend you are authorized to use. Kernel Admin's local HTTP contract lets that service supply authentication, settings and application data without requiring a particular backend repository or tooling.

## Before you start

- Install the Node version in [`.nvmrc`](../.nvmrc) and its bundled npm.
- Choose a backend compatible with the local [HTTP contracts and examples](authentication.md#backend-integration), its public address and an account managed by that service. No particular backend repository or tooling is required.
- Allow the intended frontend origin in the API's CORS configuration, including credential support. The origin includes the scheme, host and port.

Run the commands below from this repository's root. Filesystem examples use PowerShell; the npm and Vite commands also work in a POSIX shell.

## Run locally

1. Install the locked dependencies:

   ```sh
   npm ci
   ```

2. Create a local configuration file from the reviewed [public example](../.env.example). This PowerShell command refuses to overwrite an existing file:

   ```powershell
   if (Test-Path -LiteralPath .env.local) {
     throw ".env.local already exists; edit its public values instead."
   }
   Copy-Item -LiteralPath .env.example -Destination .env.local
   ```

3. Set the public values in your local file. For example, when your separately running API uses loopback port 3000:

   ```dotenv
   VITE_API_BASE_URL=http://127.0.0.1:3000
   VITE_APP_BASE_URL=/
   VITE_RELEASE_ID=local-admin
   VITE_OBSERVABILITY_URL=
   ```

   Replace the API address with your actual API origin. The example file's reserved `.invalid` hostname is not a running service. All browser build values are public; keep tokens, passwords and certificate material out of them.

4. Start the installed Vite development server on a fixed loopback port:

   ```sh
   npx vite --host 127.0.0.1 --port 5173 --strictPort
   ```

   Vite prints the local address. With the `/` base path above, open [http://127.0.0.1:5173/auth](http://127.0.0.1:5173/auth). For a base path such as `/console/`, open `/console/auth` on the same origin.

5. Wait for public settings to load, then sign in with your API-managed account. An accepted settings response allows the sign-in form to render. After sign-in, the panel displays the routes and actions allowed for that account.

The API selects language, direction, calendar and color palettes. The browser stores the choice of light/dark theme and compact mode. See [localization](localization.md) for these ownership rules.

Stop the server with `Ctrl+C`. Restart it after changing configuration.

## Application configuration reference

| Name                     | Purpose                                                                         |
| ------------------------ | ------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`      | Public API origin. Set it explicitly; it contains no credentials.               |
| `VITE_APP_BASE_URL`      | `/` or a canonical slash-terminated application base path, such as `/console/`. |
| `VITE_RELEASE_ID`        | Public build identifier. Production releases use a new immutable identifier.    |
| `VITE_OBSERVABILITY_URL` | Optional public reporting receiver; blank disables default network delivery.    |

The example and [Vite configuration](../vite.config.ts) define public values. See [deployment](deployment.md) for the public input contract and release prerequisites.

The [optional reporter](../src/shared/lib/observability.ts) sends sanitized error and performance events to the selected receiver. Leave the URL blank when no receiver is configured, or supply a custom transport through `setObservabilityTransport`. This frontend does not include or provision a receiving service.

Values already set in the process environment override values loaded from local files. Synthetic validation also disables local environment-file discovery. Use a separate terminal for an API-backed local run after working with the synthetic setup in [validation](validation.md).

## Preview a build

Use the same public configuration to build the frontend, then serve the result on a fixed loopback port:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

The build writes static assets to `dist/` and public build identity to `dist/_kernel/build.json`. With a `/` base path, open [http://127.0.0.1:4173/auth](http://127.0.0.1:4173/auth). The API must also allow this preview origin; permission for port 5173 does not cover port 4173.

A preview still uses the configured API for authentication and data. Rebuild after changing values embedded in a production build. See [deployment](deployment.md) for packaging and publication prerequisites.

## Troubleshoot a local run

| Symptom                                                                  | Check next                                                                                                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite refuses to start because the port is occupied                       | Stop only a server you own, or choose a free port and update the URL and API's allowed origin together. `--strictPort` prevents silently switching ports. |
| Initial settings show an error or the browser reports connection refused | Confirm the API is running at the configured address. Inspect the public `/settings` request and retry after correcting the problem.                      |
| The browser reports a CORS error                                         | Allow the exact frontend origin in the API, with credentials. `localhost` and `127.0.0.1` are different origins.                                          |
| `/settings` succeeds but the panel rejects its response                  | Check API compatibility and the required settings metadata in [authentication and requests](authentication.md).                                           |
| Protected requests repeatedly return 401                                 | Check the configured backend's session/refresh behavior against [authentication and requests](authentication.md).                                         |
| An operation returns 403                                                 | Check the account's server-assigned permissions. The API authorizes every operation independently of visible menus and controls.                          |
| Configuration changes have no effect                                     | Restart the development server, or rebuild before restarting preview.                                                                                     |

For a failure report, retain the HTTP status and safe `X-Request-Id`. Do not share tokens, cookies or request payloads.

Continue with [development](development.md) to change the panel, or [validation](validation.md) to verify source using synthetic fixtures.
