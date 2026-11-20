# Native Linux deployment

Use this guide to install an immutable release on an authorized Linux host.
See [deployment](../../docs/deployment.md) for the release and verification
procedure.
Render the public Nginx configuration locally and install it with the
[immutable application package](../../docs/deployment.md#build-an-immutable-package).
The configured backend owns authentication and data.

## Prerequisites

- A completed package, its immutable release ID and canonical base path.
- The selected admin/API/media origins and an API CORS policy allowing the actual admin origin.
- Privately provisioned TLS files and an authorized host where Nginx can read them.

[`nginx.env.example`](nginx.env.example) contains synthetic public values and certificate **paths**, not keys or certificates. The renderer expects absolute Unix-style target paths for `ADMIN_ROOT`, `TLS_CERTIFICATE` and `TLS_CERTIFICATE_KEY`.

## Render a new configuration

Run these local steps from the repository root. They write ignored preparation files and do not contact or configure the host.

1. Prepare a new dotenv-style public input file from the example. This PowerShell block preserves an existing file:

   ```powershell
   $publicInputs = "coverage/deployment/nginx-public.conf"
   if (Test-Path -LiteralPath $publicInputs) {
     throw "Choose a new public input filename or review the existing file."
   }
   New-Item -ItemType Directory -Path coverage/deployment -Force | Out-Null
   Copy-Item -LiteralPath deploy/native/nginx.env.example -Destination $publicInputs
   ```

2. Replace the synthetic hostname, origins, release ID and target paths in the public input file. Set `ADMIN_ROOT` to the installed package's `public/` directory, including when the application's base is `/console/`. Match `VITE_API_BASE_URL`, `VITE_APP_BASE_URL` and `VITE_RELEASE_ID` to the package manifest. Set `HTTPS_PORT` to the port clients use for HTTPS redirects. The native template listens on ports 80 and 443, so a different public HTTPS port needs a corresponding listener or edge mapping. Keep certificate contents and private keys outside this file and repository.
3. Render an unused output path:

   ```powershell
   node scripts/render-deployment.mjs --template deploy/native/nginx/admin.conf.template --config-file $publicInputs --output coverage/deployment/generated-admin.conf
   ```

   Expect `Admin Nginx configuration rendered.` and the new output file. Existing output, unsafe/traversing paths, linked inputs and unavailable public fields fail instead of being overwritten or silently substituted.

All three CLI paths are relative to the working directory and use forward-slash separators. `--config-file` parses the selected input as public dotenv data instead of using Node environment preloading. Rendering validates values; it does not establish target file existence, certificate trust, DNS or service availability.

For an authorized ACME bootstrap, render the [bootstrap template](nginx/acme-bootstrap.conf.template) with the same complete input file and a different output path. Configure the ACME client to place HTTP challenge files beneath `/var/www/letsencrypt/.well-known/acme-challenge/`. The temporary configuration returns 503 for application requests. Install the issued certificates before switching to the TLS application template.

## Install and verify on the host

1. Install the package and rendered configuration through the authorized host's release procedure. Provision certificate/key ownership privately so the Nginx process can read them.
2. Include the rendered application configuration inside Nginx's `http` context. It defines a cache-control `map` and multiple `server` blocks. On a shared edge, reconcile default rejection servers so each address and port has only one default.
3. Test the host configuration in its host shell:

   ```sh
   nginx -t
   ```

   Proceed only after a successful configuration test. Use the host's normal reload/release-switch procedure, then run [target and release-identity verification](../../docs/deployment.md#verify-and-recover).

The [application template](nginx/admin.conf.template) redirects the expected HTTP host to HTTPS, rejects unknown hosts, and preserves SPA deep links beneath the configured base. Successful hashed asset responses use immutable caching, including range responses and revalidation. Missing assets return 404 with `Cache-Control: no-store`, as do other asset errors. Documents and identity metadata also use `no-store`. Preserve its explicit CSP origins and TLS behavior when integrating with an existing edge.

If verification fails, retain the first failure and select the prior verified immutable package/configuration. Rendering success alone is not authorization or evidence of a working deployment.
