# Contract fixture quality

[The publication policy](../../.github/bootstrap-policy.json) defines the currently admitted source. Application conventions below apply when their owners are admitted; plain paths can identify planned owners and do not establish a runnable application or successful execution.

Parse changed JSON and inspect the affected local HTTP DTOs, normalization,
synthetic fixtures and consumer documentation together. Search for obsolete fields
after a rename. Do not scan ignored operator state, generated output or
dependencies, read real environments, or send live API requests to validate an
example.

Axios/MSW fixtures verify this client's expectations. Admitted Pact consumer cases
must remain synthetic.
Document and test those HTTP expectations locally. The consuming developer
chooses a compatible backend; external project source or documentation is not a
prerequisite. Disclose unexecuted deployed-backend verification separately.

Keep the requested contract scope focused, payloads realistic and non-sensitive,
and JSON valid. Sort keys only where order has no contract meaning; preserve
ordered arrays. Verify defaults and resulting response fields together, and do
not add speculative endpoints or assume deletion, authorization or lifecycle
semantics from UI labels.
