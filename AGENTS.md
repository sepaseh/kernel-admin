# Kernel Admin foundation instructions

Read [README](README.md), [Contributing](CONTRIBUTING.md), the current
[publication inventory](.github/bootstrap-policy.json) and the canonical
[validation manifest](.agents/validation.json) before changes.

This standalone npm project currently publishes framework-free admin primitives:
in-memory access-token state, HTTP key transforms, color-contrast helpers and
small shared contracts. Keep these modules independent of another checkout,
backend SDKs and UI initialization. The API owns authentication execution,
database access and storage.

The foundation has `applicationReady: false`. Do not claim a working panel,
production build, browser journey or visual check from these unit tests. A
runnable phase must introduce the React/Vite application and its complete
validation, preserving Ant Design, antd-style, React Router, Axios and directly
typed component parameters without FC aliases.

Run `npm run validate -- full` on the exact proposed snapshot before an
authorized commit or PR handoff. Keep each PR at 100 or fewer GitHub changed-file
entries, including deletions, renames and binaries. Preserve private state and
never read real environment files or credentials. Commits, pushes, remote
comments and merging require explicit authorization.

Use native CI, CodeRabbit and SonarQube Cloud evidence for the current revision.
CodeRabbit reviews are manual-only; request a review only within an authorized
cycle and respect the provider's actual allowance. Keep assistant guidance in
English and maintained human documentation in English and Persian.
