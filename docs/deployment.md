# Static hosting preparation

[English](deployment.md) · [فارسی](deployment.fa.md)

The current `assistant-guidance` phase intentionally adds finite deployment and quality prerequisites while retaining `applicationReady: false`. Templates, validators, packaging helpers and synthetic tests are available; an application entry point, production build, real Docker run and deployed checks are not current verification.

[Public configuration validation](../scripts/validate-deployment-env.mjs) checks an exact API origin, a safe slash-terminated base path, an immutable release ID and optional public observability URL. HTTPS is required except for explicit HTTP loopback. These browser-visible values must contain no credentials. The separate API must independently authorize requests and allow the actual admin origin.

[Template rendering](../scripts/render-deployment.mjs) accepts an explicit template and configuration object, validates host/port/path fields and substitutes only declared public placeholders. Its CLI reads the explicitly selected input file and writes a new output exclusively. Do not invoke it on real operator files during source verification. The three reviewed public example paths are synthetic; arbitrary environment files remain private.

[Packaging](../scripts/package-release.mjs) requires a completed `dist` tree and matching build metadata. It checks release identity, base/origin and path containment, refuses symbolic-link assets and existing release output, and omits disallowed asset names. Synthetic packaging fixtures verify those rules; they are not a production artifact or a secret-content audit.

Future authorized activation must first publish and validate the application build and its genuine browser/visual gates. Then package one immutable identity, render a new Nginx configuration, provision TLS privately, validate the intended host and switch only the verified release. Docker/Compose likewise depends on that future build. Run the network [health helper](../scripts/healthcheck.mjs) only against an explicitly authorized target; no deployment, DNS, TLS or availability result is implied here.

Read [native hosting](../deploy/native/README.md), [Docker preparation](../deploy/docker/README.md), [operations](release-operations.md) and [recovery](backup-restore.md).
