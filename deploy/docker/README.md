# Docker hosting prerequisites

[English](README.md) · [فارسی](README.fa.md)

This directory publishes preparatory Docker/Compose definitions and an owned-resource smoke helper. It does not publish a runnable panel: `applicationReady` remains false. The Dockerfile still depends on future application entry/build configuration and a registered production packaging path. Do not treat an image definition, imported helper or synthetic lifecycle test as a successful image build or Docker smoke run.

The intended image serves static admin assets through Nginx; the independent API owns authentication execution, data and storage. Public build configuration and the reviewed synthetic example are not secrets. Operator TLS material belongs outside Git and the build context, mounted read-only after a separately authorized activation.

The serving process runs as the image's `nginx` user, with internal HTTP/HTTPS ports 8080/8443. Compose maps the chosen public ports to those internal ports and drops all Linux capabilities. The Nginx PID and temporary files use the writable `/tmp` mount; the rest of the root filesystem stays read-only. The private TLS key must be readable by that user without making it world-readable, and parent directories must allow traversal. Provision ownership and permissions outside the image; never copy operator keys into the build.

The smoke helper's disposable certificate generator explicitly runs as root only to create and assign its own temporary key to `nginx`; it changes that owned directory to traversable mode and the key to owner/group-only mode. The serving container uses the image's unprivileged user, read-only certificate mount and no capabilities. Its serial readiness retries stay bounded at 60 document requests and 45 health inspections, with cancellation checked between attempts. Synthetic tests cover retry exhaustion and cleanup; no real container execution is implied.

The smoke helper and [resource owner](resources.mjs) use unique names, labels, an exact image tag, a dedicated builder and a verified temporary directory. Synthetic tests exercise orchestration and failure cleanup without starting Docker. Real execution additionally needs the complete application build, a local authorized engine and Buildx. It must attempt every owned cleanup and preserve primary and cleanup errors. Engine outages or uncatchable termination can still require operator cleanup of those exact resources. Never prune shared images, volumes or caches or change the global selected builder.

Read [deployment](../../docs/deployment.md) and [rollback](../../docs/release-operations.md) before future authorized operation.
