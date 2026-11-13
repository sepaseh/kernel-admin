# Build, package and deploy

Use this guide to prepare an immutable frontend release and verify an authorized deployment. Build and package from verified application source. The configured backend owns authentication, authorization, data and storage.

## Before you start

- Complete the source verification in [validation](validation.md) for the exact proposed source. Check [publication admission](../.github/bootstrap-policy.json); an available local helper or workflow is not evidence that it is published or has run.
- Use the Node release in [`.nvmrc`](../.nvmrc) and locked root dependencies. Run repository commands from the root of the existing checkout.
- Obtain authorization for the selected Docker engine or hosting target before starting resources or making target requests. Keep operator TLS/configuration private and out of source, image layers and build contexts.

Choose the next task:

| Task                                  | Owner                                                     | Result                                                                           |
| ------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Build and package static assets       | [Build an immutable package](#build-an-immutable-package) | New local `dist/` output and an immutable release directory.                     |
| Configure an existing Nginx host      | [Native hosting](../deploy/native/README.md)              | Rendered configuration, separately installed and checked on the authorized host. |
| Build and start the container service | [Docker hosting](../deploy/docker/README.md)              | A release image and service on the selected engine.                              |
| Check or roll back a deployed release | [Verify and recover](#verify-and-recover)                 | Target-specific document and release-identity evidence.                          |

## Public configuration

Use only the reviewed synthetic examples as source references: [browser build values](../.env.example), [Compose inputs](../deploy/docker/compose.env.example) and [native Nginx inputs](../deploy/native/nginx.env.example). Prepare operator values separately; never read a private local counterpart as a fixture.

| Value                    | Contract                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`      | Exact HTTPS API origin; HTTP is allowed only on explicit loopback. No credentials or URL path. |
| `VITE_APP_BASE_URL`      | `/` or canonical slash-delimited segments ending in `/`.                                       |
| `VITE_RELEASE_ID`        | New immutable safe release identifier, consistent across build, package and host.              |
| `VITE_OBSERVABILITY_URL` | Optional public reporting receiver; blank disables default network delivery.                   |
| `ADMIN_HOST`             | Bare public admin hostname used by the hosting configuration.                                  |
| `PUBLIC_ASSET_ORIGIN`    | Optional explicit public media origin for hosting policy.                                      |

Browser build values are public. The API must allow the actual frontend origin and independently authorize every request. Changing a build value requires a new build; serving an old bundle with different host settings does not rewrite it.

The [optional reporter](../src/shared/lib/observability.ts) uses the configured receiver for sanitized error and performance events. The receiver is separate from this standalone frontend; building or packaging the panel does not provision one. The examples leave the receiver URL blank.

When enabling reporting, set `VITE_OBSERVABILITY_URL` to the same receiver URL in both the browser build values and the separate [native Nginx input](../deploy/native/nginx.env.example). The [renderer](../scripts/render-deployment.mjs) reads that input through `--config-file` and adds the receiver's origin to CSP `connect-src`. Render and install the updated configuration so the browser can reach the receiver.

## Build an immutable package

After complete source verification, this PowerShell example builds and packages a local demonstration release. Choose an unused release ID and keep the environment value and `--release` argument identical.

1. Install the locked dependencies if they are not already installed:

   ```sh
   npm ci
   ```

2. Supply explicit public values and build. `KERNEL_SYNTHETIC_ENV` disables ambient operator environment-file discovery for this example:

   ```powershell
   $env:KERNEL_SYNTHETIC_ENV = "1"
   $env:VITE_API_BASE_URL = "http://127.0.0.1:3000"
   $env:VITE_APP_BASE_URL = "/"
   $env:VITE_RELEASE_ID = "release-demo-001"
   $env:VITE_OBSERVABILITY_URL = ""
   npm run build
   ```

   Expect static assets and `dist/_kernel/build.json`. Port 3000 is the local API example from [usage](usage.md); no API needs to be running for this build. For a real release, use the selected target's public HTTPS API origin, canonical base path and new immutable ID.

3. Package that completed build:

   ```sh
   node scripts/package-release.mjs --release=release-demo-001
   ```

   Expect `releases/release-demo-001/release.json` and `releases/release-demo-001/public/`. A non-root base such as `/console/` places application files under `public/console/`; the host's document root still points at `public/`.

4. Check the package identity and intended public contents before promotion. The [packager](../scripts/package-release.mjs) rejects an existing output directory, mismatched build/release IDs and symbolic-link assets. It excludes known private filenames but does not scan arbitrary asset contents for secrets.

Keep the build parent trusted and owned. Build identity publication uses private sibling staging and an atomic rename; it does not protect against an actor controlling that parent. Generated `dist/` and `releases/` outputs stay out of commits. Repository-specific review evidence, recovery files and scratch exports belong in ignored repository-local directories.

## Configure the selected host

Use the [native Nginx procedure](../deploy/native/README.md) or [Docker procedure](../deploy/docker/README.md) for its exact inputs and expected results. Both serve the static package and preserve explicit CSP origins, strict missing-asset responses, immutable hashed assets and no-store documents/identity metadata.

Native rendering writes a new configuration; it does not provision DNS, certificates or services. Docker startup validates required public values and Nginx configuration; health checks separately verify HTTPS loopback and expected release identity. Neither a template nor an image definition establishes deployed availability.

## Verify and recover

The [health helper](../scripts/healthcheck.mjs) makes network requests. Replace the example URL with the authorized target before running it. For a release installed at `/console/`:

```sh
node scripts/healthcheck.mjs https://admin.example.invalid/console/ release-demo-001 /console/
```

`admin.example.invalid` is a placeholder, not a live target. A zero exit code means the helper received an HTML document and the expected same-origin release identity. Credentials, query/fragment, invalid base paths, redirects and mismatched release identity fail the check. When providing an expected release, also provide its canonical base path; a deep route must remain beneath it.

| Failure                              | Check                                                                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Packaging rejects the release ID     | Match the completed build metadata; use a new ID instead of replacing an existing release directory.            |
| A deep link serves the wrong content | Align the build base path, package layout and host document root.                                               |
| TLS or container health fails        | Verify certificate trust/hostname, readable private TLS mounts and expected release. Do not disable validation. |
| Target serves an unexpected release  | Inspect the selected immutable package and host configuration before switching traffic.                         |

Keep the prior verified package and configuration until the new release passes its target checks. To roll back, select that prior package/configuration and repeat verification with its original release ID and base path. Do not rebuild an old identifier with new contents. Preserve operator TLS/configuration privately and exercise restore procedures on an authorized isolated target.

The admitted mutation and release workflows require separate authorization to dispatch. Consult their inputs and target validators before an authorized operation. Report the actual revision, target, result and first failure. Deployment and provider compatibility require evidence from the authorized target.
