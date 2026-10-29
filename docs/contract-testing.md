# HTTP contracts and future provider verification

[English](contract-testing.md) · [فارسی](contract-testing.fa.md)

Current consumer evidence is in feature API/type owners, shared transport tests and fail-closed synthetic MSW fixtures. Pure transport types live in `src/shared/api`; the shared profile limit lives in `src/shared/contracts`. Preserve snake-case wire conversion, runtime validation of critical token/settings replies, request limits and session-generation guards.

The independent API owns endpoint execution, authorization, authentication, storage, database/migrations and its Bruno collection. Admin catalogs remain local; validated API settings own language, direction, calendar and names. A successful mock consumer test is not proof that a real provider implements the contract. Coordinate incompatible wire changes and rollout with the API owner.

Pact tooling, its provider process and `contract/api.contract.test.ts` are deferred rather than published verification owners. No contract npm command or Pact dependency is added here. Future activation must reconcile consumer identity and current HTTP semantics, use isolated synthetic data, add genuine consumer/provider checks and record actual provider evidence. Never use a real account or production target as a fixture.

Run the relevant existing unit/type checks and the [canonical full gate](validation.md). These checks remain scoped to published source. See [HTTP ownership](http-client.md) and [request reliability](admin-request-reliability.md).
