# HTTP contract evidence

This frontend owns feature API modules/types, transport normalization, synthetic
Axios/MSW fixtures and local HTTP contracts. The consuming developer chooses a
backend implementing those local HTTP contracts. Frontend work requires no
external project source, documentation or services. Pact consumer and synthetic
browser checks are planned for later phases and cannot verify a deployed backend.

Review HTTP behavior against the local contract, implementation and synthetic
consumer evidence. Document incompatible request/response changes in the local
contract and tests. Deployed-backend verification requires its own target
authorization and evidence. Keep authentication execution, database and storage
access behind HTTP.

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
