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
CodeRabbit reviews are manual-only. Before a request, require every non-CodeRabbit
required check to pass for the latest head, including protected build/e2e/visual,
scanner and actual Sonar quality gate, and verify zero open/unresolved issues of
any severity in its complete applicable Sonar report, including existing code.
Missing or stale evidence blocks requests; new commits invalidate preflight.
A documented false positive still open at Sonar blocks requests too. Follow
[Contributing](CONTRIBUTING.md#before-requesting-coderabbit) for authorization,
quota and duplicate-request rules; exclude CodeRabbit's own check/approval only
from preflight to avoid a cycle. Keep assistant guidance in English and maintained
human documentation in English and Persian.
