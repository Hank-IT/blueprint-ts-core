# Headers

Requests assemble headers from multiple sources before sending:

1. **Driver defaults** (global headers set on the driver)
2. **Request headers** returned by `requestHeaders()`
3. **Body headers** from the request body factory (e.g., `Content-Type`)

Later sources override earlier ones. Header values can be strings or callbacks that resolve at send time.

## Global Headers (Driver)

Set headers once when you configure the driver:

```typescript
BaseRequest.setRequestDriver(new FetchDriver({
    headers: {
        'X-XSRF-TOKEN': () => getCookie('XSRF-TOKEN')
    },
}))
```

## Per-Request Headers

Override `requestHeaders()` on a request to add headers per request:

```typescript
import { type HeadersContract } from '@blueprint-ts/core/requests'

public override requestHeaders(): HeadersContract {
    return {
        Authorization: `Bearer ${this.accessToken}`
    }
}
```

## Body Headers

Request body factories can set headers such as `Content-Type`. For example, `JsonBodyFactory` sets
`Content-Type: application/json`.
