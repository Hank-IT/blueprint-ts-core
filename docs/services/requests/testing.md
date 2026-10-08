# Testing Requests

Keep request classes, serialization, error normalization, and production client subscriptions active. Replace the transport with `MockRequestDriver` using a fresh scope per test.

<<< ../../examples/v6.ts#testing

In a test suite, create the scope in `beforeEach` and always call `scope.dispose()` in `afterEach`. Pass the application's configured client factory to `createMockRequestScope({ client: createAppClient() })` so the same authentication and other shared listeners execute. The mock overrides class-selected transports too; an explicit instance `setRequestDriver()` is reserved for tests exercising a real transport boundary.

## Strict expectations

`expect()` preserves ordered exact matching. `expectAny(criteria)` selects a matching pending expectation without requiring call order. Use `.withHeaders(predicate)` and `.withBody(expectJsonBody(expected))` to assert the actual serialized request. `expectJsonBody(expected, { partial: true })` supports deliberate partial matching. Expectations are consumed once.

`allow(criteria, responseOrResolver, { maxCalls })` provides an explicitly bounded repeated response. Do not use unbounded fallback responses for unexpected traffic. `deferredResponse()` provides a controllable response for loading, cancellation, and overlapping requests:

```ts
const pending = deferredResponse()
scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url }).respond(pending.respond)
const saving = request.send()
pending.resolve(jsonResponse(200, saved))
await saving
```

Disposal verifies unconsumed expectations and retained matching failures. Catching a rejection in application code does not hide an unexpected request. `reset()` and `resetMockRequestDriver()` verify first; a reset cannot erase a mismatch. History remains available for diagnostics.

## Responses and request history

Response builders describe transport responses, including unsuccessful HTTP statuses:

| Helper                                 | Use                                                                  |
| -------------------------------------- | -------------------------------------------------------------------- |
| `jsonResponse(status, body, headers?)` | JSON successes, conflicts, and other API responses.                  |
| `validationError(errors, message?)`    | An HTTP 422 response that passes through normal error normalization. |
| `emptyResponse(status?, headers?)`     | A response without a body, defaulting to HTTP 204.                   |
| `deferredResponse()`                   | Resolve or reject a pending transport response explicitly.           |

Inspect `scope.driver.getHistory()` to assert the actual serialized traffic. Each entry includes method, absolute URL, resolved headers, normalized body, and driver configuration. Use `getMockRequestJsonBody(entry)`, `getMockRequestTextBody(entry)`, or `getMockRequestQuery(entry)` to decode the representation. Multipart history contains individual text and file entries; binary bodies preserve byte content. History also retains attempted requests that failed matching.

Matchers can restrict method, URL, query parameters, headers, and body. Header and body objects match exactly; use predicates or `expectJsonBody(value, { partial: true })` when the test intentionally checks a subset. A response resolver receives the matched request, allowing a test to compute its response from the actual request. Required expectations take precedence over `allow()` rules.

## Testing application flows

For a form backed by an API, provide the read response, load it through the real request, edit the rendered controls, and assert the serialized save body and headers. Return the saved values explicitly and verify the displayed values and dirty state. A second save can verify that the caller uses the updated state.

Test failures through response builders so error normalization and the application's error handling execute. Use pending responses to check loading indicators and duplicate-action guards.

Mock the transport rather than replacing request methods or form payload construction. For Fetch/XHR transport tests, replace the browser API and retain the driver and request pipeline. Cover the JSON, binary, or multipart bodies used by the application.
