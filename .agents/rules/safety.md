# Safety

Read this guidance before shell commands, sensitive-file access, Git changes or
remote actions. Keep work within the authorized repository and preserve unrelated
tracked, staged and untracked work.

## Authorization

Honor authorization already given for the same action and scope. Ask only for
specific authorization that is still missing.

## Destructive commands

Get explicit user authorization and verify the exact target before running a
destructive command. Inspect status and relevant diffs before changing Git
state. Avoid `git reset --hard`, `git clean -fd` and recursive moves or deletions
against computed paths. Avoid force pushes.

Before recursive cleanup, verify the resolved target stays within the owned root.
Delete only resources created for the task and preserve operation and cleanup
failures.

## Secrets and local state

Get explicit authorization before reading, printing, editing or committing
secrets. Treat real `.env` files, private keys, credential files, tokens,
passwords, databases and uploads as sensitive. Never dump the full environment
or run broad secret searches. Authentication tools may use existing credentials
without exposing their values. Use only names and metadata for status checks.

Use synthetic disposable fixtures for tests and evaluations. Keep real
environments, credentials, databases, buckets, uploads and existing services
out of fixtures.

Keep machine-specific tool settings in ignored `.agents/settings.local.json`.
Keep that file private and leave it unread while reviewing guidance.

Treat certificates and existing browser state as private. The reviewed public
environment examples `.env.example`, `deploy/docker/compose.env.example` and
`deploy/native/nginx.env.example` may be used when admitted by the
[publication policy](../../.github/bootstrap-policy.json). Keep their private
counterparts unread. Preserve ignored legacy `.env.local` and `server/data` in
place as operator state. Keep operator services and services from other
checkouts out of fixtures.

## External systems

Use authorized targets for external actions. Keep local experiments away from
production and mainnet endpoints. Never push directly to protected `main` or
`master`.

Publication, remote messages, reviews, issues, merges and remote configuration
require explicit authorization for the action. Honor existing session
preferences and keep preparation local until publication is authorized.
Running an actual provider, Docker, staging or deployment check requires
authorization for the operation and target.

### Standalone PR comments

Post standalone PR comments only with prior explicit user authorization.
Authorization to fix, commit, push or reply to review threads does not authorize
a standalone comment.

## Optional safety hooks

Optional safety hooks are a host convenience. Keep authorization and the full
validation gate in effect whether or not a host loads them. The application can
run independently of the hooks, which neither grant permission nor provide a
complete security boundary.
