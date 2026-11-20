# Run Kernel Admin

Use this guide to configure Kernel Admin and sign in locally with a compatible backend.

## Before you start

- Install the Node version in [`.nvmrc`](../.nvmrc) and its bundled npm.
- Have an API base URL and a test account for a backend you are authorized to use. Compare the service with the [HTTP contracts and examples](authentication.md#backend-integration).
- For an API on a different origin, allow credentialed requests from the exact frontend origin in the API's CORS configuration. The origin includes the scheme, host and port. Use a browser-compatible cookie policy for session refresh.

Run the commands below from this repository's root. Filesystem examples use PowerShell; the npm and Vite commands also work in a POSIX shell.

## Run locally

1. Install the locked dependencies with the repository's peer-dependency checks enabled.

   ```sh
   npm ci --strict-peer-deps --no-audit --no-fund
   ```

2. Create `.env.local` from the [public example](../.env.example) if it is missing. The PowerShell command preserves an existing file.

   ```powershell
   if (-not (Test-Path -LiteralPath .env.local)) {
     Copy-Item -LiteralPath .env.example -Destination .env.local
   }
   ```

3. Edit `.env.local` to use your API. The following values assume the API is listening on loopback port 3000.

   ```dotenv
   VITE_API_BASE_URL=http://127.0.0.1:3000
   VITE_APP_BASE_URL=/
   VITE_RELEASE_ID=local-admin
   ```

   Replace the reserved `.invalid` address from the example with the base URL of your running API. Keep tokens, passwords and certificate material out of browser configuration.

4. Start the installed Vite development server on a fixed loopback port.

   ```sh
   npm exec --no -- vite --host 127.0.0.1 --port 5173 --strictPort
   ```

   Vite prints the local address. With the `/` base path above, open [http://127.0.0.1:5173/auth](http://127.0.0.1:5173/auth). For a base path such as `/console/`, open `/console/auth` on the same origin.

5. Wait for public settings to load, then sign in with your API-managed account. The dashboard opens with the navigation and actions available to your account. If the panel displays a settings error, check the `GET /settings` response and select **Retry**.

The API selects language, direction, calendar and color palettes. The browser stores the choice of light/dark theme and compact mode. See [localization](localization.md) for these ownership rules.

Stop the server with `Ctrl+C`. Restart it after changing configuration.

## Application configuration reference

| Name                | Purpose                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL` | Public HTTP(S) API base. The development server accepts a path prefix such as `/v1`. For a stamped build, use the exact origin with no trailing slash. |
| `VITE_APP_BASE_URL` | `/` or a canonical slash-terminated application base path, such as `/console/`.                                                                        |
| `VITE_RELEASE_ID`   | Public build identifier. Production releases use a new immutable identifier.                                                                           |

The example and [Vite configuration](../vite.config.ts) define public values. See [deployment](deployment.md) for the public input contract and release prerequisites.

Values already set in the process environment override values loaded from local files. Synthetic validation also disables local environment-file discovery. Use a separate terminal for an API-backed local run after working with the synthetic setup in [validation](validation.md).

## Preview a build

Set the public build values in your terminal before building. The [build stamp](../scripts/stamp-admin-build.mjs) reads these values from the process environment. For the local API above, use PowerShell from the repository root.

```powershell
$env:VITE_API_BASE_URL = 'http://127.0.0.1:3000'
$env:VITE_APP_BASE_URL = '/'
$env:VITE_RELEASE_ID = 'local-preview'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'The build failed. Correct the reported error before starting preview.' }
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

The build writes static assets to `dist/` and public build identity to `dist/_kernel/build.json`. With a `/` base path, open [http://127.0.0.1:4173/auth](http://127.0.0.1:4173/auth). The API must also allow this preview origin; permission for port 5173 does not cover port 4173.

A preview uses the API embedded in the build for authentication and data. Stop preview with `Ctrl+C` before rebuilding. See [deployment](deployment.md) for the supported hosting inputs and release procedure.

## Troubleshoot a local run

| Symptom                                                                  | Check next                                                                                                                                                                               |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite refuses to start because the port is occupied                       | Stop only a server you own, or choose a free port and update the URL and API's allowed origin together. `--strictPort` prevents silently switching ports.                                |
| Initial settings show an error or the browser reports connection refused | Confirm the API is running at the configured address. Inspect the public `/settings` request and retry after correcting the problem.                                                     |
| The browser reports a CORS error                                         | Allow the exact frontend origin in the API, with credentials. `localhost` and `127.0.0.1` are different origins.                                                                         |
| `/settings` succeeds but the panel fails to render                       | Check the required settings shape, including the API's language metadata and palettes. The settings adapter uses typed models. [Settings requirements](localization.md#runtime-metadata) |
| Protected requests repeatedly return 401                                 | Check the configured backend's session/refresh behavior against [authentication and requests](authentication.md).                                                                        |
| An operation returns 403                                                 | Check the account's server-assigned permissions. The API authorizes every operation independently of visible menus and controls.                                                         |
| Configuration changes have no effect                                     | Restart the development server, or rebuild before restarting preview.                                                                                                                    |

For a failure report, retain the HTTP status and safe `X-Request-Id`. Do not share tokens, cookies or request payloads.

Continue with [development](development.md) to change the panel, or [validation](validation.md) to verify source using synthetic fixtures.
