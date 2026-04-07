# Testing

`MockRequestDriver` lets you test request classes without performing real HTTP calls. It supports strict ordered
matching by default, optional unordered matching, predicate-based request matchers, capture-first expectations,
response builders, and global setup helpers.

## Choosing An Install Style

There are two setup styles:

- global test setup with `installMockRequestDriver(...)`
- per-request-instance setup with `request.setRequestDriver(...)`

Use the global helper when most requests in the test should go through the mock driver. Use the instance-level setter
when only one request object should be mocked and the rest of the application should keep using the normal global
driver. The global helper is recommended for most tests.

## Basic Usage

```typescript
import {
    BaseRequest,
    MockRequestDriver,
    RequestMethodEnum,
    jsonResponse
} from '@blueprint-ts/core/requests'

const driver = new MockRequestDriver()
    .expect({
        method: RequestMethodEnum.POST,
        url: 'https://example.com/api/v1/users',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        body: {
            name: 'Ada'
        },
        response: jsonResponse(201, {
            id: 1,
            name: 'Ada'
        })
    })

const request = new CreateUserRequest()
    .setRequestDriver(driver)
    .setBody({ name: 'Ada' })

const response = await request.send()

expect(response.getBody()).toEqual({
    id: 1,
    name: 'Ada'
})

driver.assertExpectationsMet()
```

With this default setup, each request must match the next queued expectation exactly.

Use the same URL that `request.buildUrl()` would produce. If query parameter ordering is incidental in the test, keep
the base URL in `url` and assert query semantics separately with the `query` field or `matchQuery(...)`.

## Ordered And Unordered Matching

Ordered matching is the default:

```typescript
const driver = new MockRequestDriver()
```

If request order should not matter, opt into unordered matching:

```typescript
const driver = new MockRequestDriver(undefined, [], {
    matchMode: 'unordered'
})
```

In unordered mode, the driver checks all pending expectations and consumes the first one that matches.

This is useful when:

- background requests can arrive in either order
- preload requests make strict ordering brittle
- a test cares about which requests happened, but not their exact sequence

## Predicate Matchers

Exact matching remains the default. For looser assertions, use predicate helpers:

```typescript
import {
    MockRequestDriver,
    RequestMethodEnum,
    expectJsonBody,
    jsonResponse,
    matchHeaders,
    matchQuery
} from '@blueprint-ts/core/requests'

const driver = new MockRequestDriver()

driver
    .expectAny({
        method: RequestMethodEnum.POST,
        url: 'https://example.com/api/v1/jobs'
    })
    .withHeaders(matchHeaders({
        Accept: 'application/json'
    }))
    .withQuery(matchQuery({
        draft: '1'
    }))
    .withBody(expectJsonBody({
        job: {
            name: 'Build'
        }
    }, { partial: true }))
    .respond(jsonResponse(200, { ok: true }))
```

Available helpers:

- `matchHeaders(...)` checks that selected resolved headers are present
- `matchQuery(...)` checks selected query params
- `expectJsonBody(...)` matches parsed JSON request bodies

When you use a separate `query` matcher, the URL expectation should usually be the request URL without its query string.
That lets the mock driver compare the path exactly and the query parameters structurally.

Use `{ partial: true }` with `expectJsonBody(...)` when only part of the JSON payload matters.

## Capture Then Assert

Sometimes you want to allow a request and inspect it afterward instead of fully specifying the body up front:

```typescript
import {
    MockRequestDriver,
    RequestMethodEnum,
    emptyResponse,
    getMockRequestJsonBody
} from '@blueprint-ts/core/requests'

const driver = new MockRequestDriver()

driver
    .expectAny({
        method: RequestMethodEnum.POST,
        url: 'https://example.com/api/v1/editor/save'
    })
    .respond(emptyResponse())

await saveRequest.send({ resolveBody: false })

const history = driver.getHistory()
const payload = getMockRequestJsonBody(history[0])

expect(payload).toEqual({
    content: 'Updated document'
})
```

This pattern is useful when the exact payload is easier to assert after the action that triggered the request.

## Response Builders

Blueprint includes helpers for common mock responses:

```typescript
import {
    emptyResponse,
    jsonResponse,
    validationError
} from '@blueprint-ts/core/requests'

jsonResponse(200, { ok: true })
emptyResponse() // 204 by default
validationError({
    name: ['The name field is required.']
})
```

`validationError(...)` returns a `422` JSON response, so `BaseRequest.send()` still routes it through the normal
request error handling flow.

## Install And Reset Helpers

For shared test setup, install a global mock driver once:

```typescript
import {
    installMockRequestDriver,
    resetMockRequestDriver
} from '@blueprint-ts/core/requests'

beforeEach(() => {
    resetMockRequestDriver()
})

const driver = installMockRequestDriver()
```

If you need unordered mode from the start:

```typescript
const driver = installMockRequestDriver({
    matchMode: 'unordered'
})
```

`resetMockRequestDriver()` clears expectations and history on the installed driver.

If you only want to mock one request instance, prefer the instance-level setter instead of changing the global driver:

```typescript
const driver = new MockRequestDriver()

const request = new CreateUserRequest()
    .setRequestDriver(driver)
```

This is a good choice when one request instance should be mocked and the global request bootstrap should remain
unchanged.

## Inspecting History

`getHistory()` still returns normalized request snapshots. Helper functions are available for common follow-up
assertions:

```typescript
import {
    getMockRequestJsonBody,
    getMockRequestQuery,
    getMockRequestTextBody
} from '@blueprint-ts/core/requests'

const entry = driver.getHistory()[0]

const json = getMockRequestJsonBody(entry)
const query = getMockRequestQuery(entry)
const text = getMockRequestTextBody(entry)
```

The normalized history supports:

- JSON and plain text bodies
- `FormData`
- `Blob`
- typed arrays and other `BufferSource` payloads

You can still assert against the raw normalized body shape when needed, but the helper functions are usually the more
ergonomic choice for JSON/text requests.

## Failure Output

When a request does not match, the driver throws `MockRequestAssertionError` with:

- the mismatch field
- the expected request summary
- the actual request summary
- expected and actual values for the mismatched field
- JSON diff paths when the body mismatch is JSON

This keeps debugging practical even when tests use loose matchers or unordered mode.

## Finishing A Test

Use `assertExpectationsMet()` at the end of the test to ensure all expectations were consumed:

```typescript
driver.assertExpectationsMet()
```

If you want to clear both queue and history manually:

```typescript
driver.reset()
```
