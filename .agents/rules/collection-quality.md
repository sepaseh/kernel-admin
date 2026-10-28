# Contract fixture quality

Parse changed JSON and inspect the affected local HTTP DTOs, normalization,
synthetic fixtures and consumer documentation together. Search for obsolete fields
after a rename. Do not scan ignored operator state, generated output or
dependencies, read real environments, or send live API requests to validate an
example.

This phase publishes synthetic Axios/MSW integration coverage rather than a
Bruno collection, Pact suite or complete application journey. Required API-owned
examples and provider changes remain with that repository; coordinate them and
disclose unavailable evidence instead of claiming they were checked here.

Keep the requested contract scope focused, payloads realistic and non-sensitive,
and JSON valid. Sort keys only where order has no contract meaning; preserve
ordered arrays. Verify defaults and resulting response fields together, and do
not add speculative endpoints or assume deletion, authorization or lifecycle
semantics from UI labels.
