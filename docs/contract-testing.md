# HTTP consumer contracts and provider verification

[English](contract-testing.md) · [فارسی](contract-testing.fa.md)

Current consumer evidence is in feature API/type owners, shared transport tests and fail-closed synthetic MSW fixtures. Pure transport types live in `src/shared/api`; the shared profile limit lives in `src/shared/contracts`. Preserve snake-case wire conversion, runtime validation of critical token/settings replies, request limits and session-generation guards.

The independent API owns endpoint execution, authorization, authentication, storage, database/migrations and its Bruno collection. Admin catalogs remain local; validated API settings own language, direction, calendar and names. A successful mock consumer test is not proof that a real provider implements the contract. Coordinate incompatible wire changes and rollout with the API owner.

In the application-verification phase, `contract/api.contract.test.ts` runs the real admin client adapters against an exclusively owned local Pact mock provider. The consumer is `kernel-admin` and the provider contract is `kernel-api`. Cases cover login/token mapping, authenticated account data, request correlation on server errors, recovery-policy rejection and the final-administrator conflict. Inputs and credentials are synthetic; no real API or account is contacted.

Generated Pact documents go under `coverage/contract/pacts`. They are outputs of the checked source, not maintained application inputs or proof that the independent provider conforms. Keep them out of source inventory and publication. Run `npm run test:contract` as declared by the [manifest](../.agents/validation.json); a focused consumer pass cannot replace the full exact-tree gate.

Provider verification remains owned by the independent API and requires its actual implementation, compatible states and an explicitly authorized target. Record the precise consumer/provider revisions and observed result before claiming compatibility. Neither generating a Pact document nor passing a local mock test supplies that evidence.

Run the relevant existing unit/type checks and the [canonical full gate](validation.md). These checks remain scoped to published source. See [HTTP ownership](http-client.md) and [request reliability](admin-request-reliability.md).
