# Admin input validation

[English](input-validation.md) · [فارسی](input-validation.fa.md)

Reuse profileNameMaxLength from the local src/shared/contracts module in profile, registration and management forms. Existing API adapters normalize snake_case and optional/nullable responses at the boundary. Client validation improves feedback; the API independently validates types, limits, permissions and transaction invariants.

Optional omitted/blank profile names retain server values; supplied wrong types/oversized values fail on the API before writes. Auth creation requirements and password policy retain their existing behavior. Do not add a frontend-only validation engine or infer server authorization from a disabled control.

Real React/Ant Design form tests verify local validation and keyboard controls in isolated jsdom. Feature API tests verify synthetic HTTP behavior. Read the [publication policy](../.github/bootstrap-policy.json) and [canonical gate](../.agents/validation.json) to identify admitted Pact and browser checks, then report their actual results separately. Synthetic consumer and browser checks do not verify a real API provider. See [business screens](business-screens.md).
