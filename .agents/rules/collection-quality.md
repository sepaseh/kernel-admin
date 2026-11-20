# Contract fixture quality

Update the affected Axios, MSW or Pact fixture against the [local HTTP
contract](api-collection.md) and its consumer documentation. Cover the request
fields the client sends and the response fields the adapter reads, including
backend-supplied defaults. Use the endpoint and permission contracts as evidence
for deletion, authorization and other lifecycle behavior.

## Validate changes

- Parse changed JSON.
- Search maintained source, examples and tests for old field names after renames.
  Exclude ignored operator state, dependencies and generated output.

Sort keys only where order has no contract meaning and preserve ordered arrays.

Use realistic synthetic payloads, including synthetic values for signed URLs and
personal fields. Follow the [fixture isolation rules](testing.md#isolate-fixtures)
for request handling and target access.
