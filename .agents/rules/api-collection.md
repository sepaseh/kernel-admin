# HTTP contract evidence

This admin has no local API implementation or Bruno collection. The separate API
owner maintains server behavior and its executable wire evidence. This checkout
owns feature API modules/types, transport normalization, synthetic Axios/MSW
fixtures and consumer documentation. Pact collections and complete cross-service
journeys are not published in the current phase.

Verify behavior against authorized current contract evidence. A matching DTO or
another checkout's test does not prove wire compatibility here. Coordinate
incompatible request/response changes and rollout with the API owner; do not copy
its server, collection, authentication, database or storage source into admin.

- Review request and response behavior together. Backend-owned creation defaults
  must be omitted from frontend writes and validated in required response fields.
- Wire fields use `snake_case`; normalize to domain `camelCase` at the HTTP boundary.
- Keep feature endpoint paths in the owning `api.ts`, using descriptive local path
  constants. Shared infrastructure stays in `src/shared/api`.
- Prefer omission for absent optional fields unless `null` has protocol meaning.
- Do not invent fields, envelopes, permissions, errors, status codes or timestamp
  units without current evidence.
- Calendar date keys remain Gregorian `YYYY-MM-DD`; runtime language, direction
  and calendar follow validated API metadata.
- Keep all examples synthetic. Never read real credentials, signed URLs, private
  operator state or personal data for a contract test.
