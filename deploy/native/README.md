# Configure native Nginx hosting

The `release-prerequisites` snapshot admits the Nginx templates and renderer. Rendering prepares public configuration locally. Installing it on an authorized host requires an [immutable package](../../docs/deployment.md#build-an-immutable-package) from the later application phase. The developer's configured backend remains responsible for authentication and data.

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

2. Replace the synthetic hostname/origins, release ID and target paths in that public input file. Set `ADMIN_ROOT` to the installed package's `public/` directory, including when the application's base is `/console/`. Keep the release/base values identical to the build. Keep certificate contents and private keys outside this file and repository.
3. Render an unused output path:

   ```sh
   node scripts/render-deployment.mjs --template deploy/native/nginx/admin.conf.template --config-file coverage/deployment/nginx-public.conf --output coverage/deployment/generated-admin.conf
   ```

   Expect `Admin Nginx configuration rendered.` and the new output file. Existing output, unsafe/traversing paths, linked inputs and unavailable public fields fail instead of being overwritten or silently substituted.

All three CLI paths are relative to the working directory and use forward-slash separators. `--config-file` parses the selected input as public dotenv data instead of using Node environment preloading. Rendering validates values; it does not establish target file existence, certificate trust, DNS or service availability.

For an authorized ACME bootstrap, select [`nginx/acme-bootstrap.conf.template`](nginx/acme-bootstrap.conf.template) with the same complete input file and a different output path. That temporary HTTP-only configuration serves ACME challenges and returns 503 for application requests. Install valid certificates before switching to the TLS application template.

## Install and verify on the host

1. Install the package and rendered configuration through the authorized host's release procedure. Provision certificate/key ownership privately so the Nginx process can read them.
2. Reconcile virtual hosts before enabling the configuration. A shared edge listener needs one default rejection server per address/port; do not install duplicate default-server blocks.
3. Test the host configuration in its host shell:

   ```sh
   nginx -t
   ```

   Proceed only after a successful configuration test. Use the host's normal reload/release-switch procedure, then run [target and release-identity verification](../../docs/deployment.md#verify-and-recover).

The [application template](nginx/admin.conf.template) redirects the expected HTTP host to HTTPS, rejects unknown hosts, preserves SPA deep links beneath the configured base and returns 404 for missing hashed assets. Hashed assets are immutable; documents and identity metadata use no-store. Preserve its explicit CSP origins and TLS behavior when integrating with an existing edge.

If verification fails, retain the first failure and select the prior verified immutable package/configuration. Rendering success alone is not authorization or evidence of a working deployment.
