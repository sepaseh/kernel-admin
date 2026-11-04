# Build and run the Docker service

Use this procedure to build an immutable frontend image and start it on an authorized local Linux Docker engine. Developers configure a compatible HTTP backend separately from this static frontend image. [Deployment](../../docs/deployment.md) owns public configuration, release identity and target verification.

## Prerequisites

- The exact source admits the application entry point and build configuration and has passed complete application [validation](../../docs/validation.md). The `release-prerequisites` snapshot publishes the Docker definition with `applicationReady: false`.
- Docker with Compose and Buildx is available on the selected engine.
- Authorization covers building and starting resources on that engine and contacting the selected target.
- DNS, the public admin/API/media origins and the API's frontend CORS policy are configured for the target.
- An existing absolute TLS directory contains `fullchain.pem` and `privkey.pem`. Keep both outside the build context and provision key access for the image's unprivileged `nginx` user without making the key world-readable.

## Prepare public inputs

Run repository commands from the existing checkout's root. This PowerShell example copies only the reviewed public template and preserves an existing preparation file:

```powershell
$publicInputs = "coverage/deployment/compose-public.conf"
if (Test-Path -LiteralPath $publicInputs) {
  throw "Choose a new public input filename or review the existing file."
}
New-Item -ItemType Directory -Path coverage/deployment -Force | Out-Null
Copy-Item -LiteralPath deploy/docker/compose.env.example -Destination $publicInputs
```

Replace the synthetic host/origins and placeholder release ID in that file. Select a new immutable `VITE_RELEASE_ID`, its canonical `VITE_APP_BASE_URL`, the intended `BIND_ADDRESS` and public HTTP/HTTPS ports. Set `TLS_CERT_DIRECTORY` to the existing private mount source. The preparation file contains public values and paths, never certificate contents or keys; `coverage/` is ignored by Git and the Docker build context.

The [Compose definition](compose.yaml) maps the selected public ports to internal HTTP 8080 and HTTPS 8443. The TLS mount is read-only and does not create a missing source directory. The public HTTPS port also enters the built Nginx redirect configuration, so keep it consistent with the actual listener.

## Build and start the service

1. Select the authorized local engine explicitly. For Docker Desktop's Linux engine on Windows, use this PowerShell value:

   ```powershell
   $dockerEngine = "npipe:////./pipe/dockerDesktopLinuxEngine"
   ```

   On a host using the local Unix socket, use `unix:///var/run/docker.sock` instead. Do not change a global Docker context or builder to select this deployment.

2. Resolve and inspect the public Compose configuration:

   ```powershell
   docker --host $dockerEngine compose --env-file coverage/deployment/compose-public.conf -f deploy/docker/compose.yaml config
   ```

   Confirm the image tag, build arguments, bindings and TLS mount source. This result describes the configuration; it does not establish a built image or healthy service.

3. Build the new release image and start the service:

   ```powershell
   docker --host $dockerEngine compose --env-file coverage/deployment/compose-public.conf -f deploy/docker/compose.yaml up --build --detach admin
   ```

   Expect image `kernel-admin:<VITE_RELEASE_ID>` and the `admin` service. Startup validates required public host/base/release values and runs `nginx -t` before serving. Use the same explicit engine and input file to inspect service status and logs.

4. Require healthy container status, then perform [authorized target verification](../../docs/deployment.md#verify-and-recover) with the same release ID and base path. Container health checks use HTTPS loopback with certificate/hostname verification and exact release identity; a redirect or mismatch fails. Container health alone does not establish external DNS, listener reachability or API compatibility.

Browser values and the rendered Nginx policy are baked into the image. Changing the public input file or restarting an old image cannot rewrite them. Build a new immutable release image for changed values; do not reuse an old release identifier for different bytes.

The service drops capabilities, prevents privilege escalation, uses a read-only root with writable `/tmp` and bounds local logs. Preserve these controls. If startup or health fails, retain the first error and check public values, port bindings, TLS filenames, access permissions and trust before selecting the previous verified immutable image/configuration. Follow [deployment recovery](../../docs/deployment.md#verify-and-recover) and verify that previous release after switching.

## Run the optional synthetic engine check

`node scripts/test-docker-release.mjs` builds and starts a separate synthetic fixture after the application build inputs are admitted. It requires explicit authorization for its local engine and Buildx. The helper selects Docker Desktop's Linux named pipe on Windows and `/var/run/docker.sock` on other hosts. Its evidence applies to the synthetic fixture.

[`docker-smoke-resources.mjs`](../../scripts/docker-smoke-resources.mjs) owns its unique builder, image, container, labels and disposable TLS directory. The check exercises TLS/unknown-host rejection, SPA subpaths, asset caching/404s, headers and release readiness. It must attempt all owned cleanup and preserve primary and cleanup failures. Synthetic lifecycle tests do not start Docker. Never prune shared resources or alter the global selected builder to recover from a failed fixture.
