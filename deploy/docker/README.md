# Docker hosting prerequisites

[English](README.md) · [فارسی](README.fa.md)

This directory publishes preparatory Docker/Compose definitions and an owned-resource smoke helper. It does not publish a runnable panel: `applicationReady` remains false. The Dockerfile still depends on future application entry/build configuration and a registered production packaging path. Do not treat an image definition, imported helper or synthetic lifecycle test as a successful image build or Docker smoke run.

The intended image serves static admin assets through Nginx; the independent API owns authentication execution, data and storage. Public build configuration and the reviewed synthetic example are not secrets. Operator TLS material belongs outside Git and the build context, mounted read-only after a separately authorized activation.

The smoke helper and [resource owner](resources.mjs) use unique names, labels, an exact image tag, a dedicated builder and a verified temporary directory. Synthetic tests exercise orchestration and failure cleanup without starting Docker. Real execution additionally needs the complete application build, a local authorized engine and Buildx. It must attempt every owned cleanup and preserve primary and cleanup errors. Engine outages or uncatchable termination can still require operator cleanup of those exact resources. Never prune shared images, volumes or caches or change the global selected builder.

Read [deployment](../../docs/deployment.md) and [rollback](../../docs/release-operations.md) before future authorized operation.
