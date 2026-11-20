# HTTP contracts

The consuming developer chooses a backend implementing this frontend's local HTTP
contract. Keep server authentication, database and storage operations behind
HTTP. Review requests, responses and transport normalization against the local
feature modules and types. Document incompatible changes and update their
[contract fixtures](collection-quality.md). The local contract and synthetic
consumer checks are sufficient for frontend verification without external
project source, documentation or services. Verifying a deployed backend
requires separate authorization for the target and evidence from that deployment.

## Wire and example conventions

- Review request and response behavior together. Omit backend-owned creation
  defaults from frontend requests. Include them in successful responses when
  the resulting domain model requires them.
- Use `snake_case` in wire JSON and query fields. Convert to `camelCase` at the
  transport boundary when the consumer needs it.
- Omit absent optional fields in payloads and examples unless `null` has
  explicit protocol meaning.
- Base changes to fields, envelopes, permissions, errors and status codes on
  verified contract evidence.
- Check timestamp units against the contract and verify creation defaults in
  the required response fields.
- Keep feature endpoint paths in the owning `api.ts`, using descriptive local path
  constants. Shared infrastructure stays in `src/shared/api`.
- Keep calendar date keys Gregorian when the displayed calendar changes. Follow
  the [date contract](../../docs/localization.md#dates) for the wire format and
  API metadata.
- Keep tokens and payloads synthetic. Keep credentials, private endpoints, real
  signed URLs and personal data out of committed fixtures and examples.
