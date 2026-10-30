# HTTP contracts and provider evidence

[English](contract-testing.md) · [فارسی](contract-testing.fa.md)

Current consumer evidence is in feature API/type owners, shared transport tests and fail-closed synthetic MSW fixtures. Pure transport types live in `src/shared/api`; the shared profile limit lives in `src/shared/contracts`. Preserve snake-case wire conversion, runtime validation of critical token/settings replies, request limits and session-generation guards.

The independent API owns endpoint execution, authorization, authentication, storage, database/migrations and its Bruno collection. Admin catalogs remain local; validated API settings own language, direction, calendar and names. A successful mock consumer test is not proof that a real provider implements the contract. Coordinate incompatible wire changes and rollout with the API owner.

Use [the publication policy](../.github/bootstrap-policy.json) and [validation manifest](../.agents/validation.json) to determine whether Pact dependencies, `contract/api.contract.test.ts` and a contract command are admitted. When they are admitted, use the `kernel-admin` consumer identity, current HTTP semantics and an exclusively owned local mock server with synthetic data. That genuine consumer test remains distinct from separately authorized verification against the API provider. While `applicationReady` is false, consumer fixtures alone cannot establish a runnable application. Never use a real account or production target as a fixture.

Run the relevant existing unit/type checks and the [canonical full gate](validation.md). These checks remain scoped to published source. See [HTTP ownership](http-client.md) and [request reliability](admin-request-reliability.md).
