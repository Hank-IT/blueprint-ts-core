# Drivers

Requests are executed by a request driver. The library includes a `FetchDriver`, an `XMLHttpRequestDriver`, and also
lets you provide your own by implementing `RequestDriverContract`.

Configure a [shared client](./getting-started) before constructing requests. The examples below update that client. Shared processing belongs in [client events](./events), above Fetch, XHR, and mock transports.

## Fetch Driver

```typescript
import { BaseRequest, FetchDriver } from '@blueprint-ts/core/requests'

BaseRequest.getDefaultClient().setDriver(new FetchDriver())
```

The `FetchDriver` supports:

- Global headers
- `corsWithCredentials` configuration
- `AbortSignal` via request config

## XMLHttpRequest Driver

Use `XMLHttpRequestDriver` when you need upload progress events for file uploads:

```typescript
import { BaseRequest, XMLHttpRequestDriver } from '@blueprint-ts/core/requests'

BaseRequest.getDefaultClient().setDriver(new XMLHttpRequestDriver())
```

It supports the same configuration as `FetchDriver` and additionally forwards upload progress through
`RequestEvents.UPLOAD_PROGRESS`.

That includes:

- `corsWithCredentials`
- `headers`
- dynamic header callbacks such as `() => getCookie('XSRF-TOKEN')`

## Request-Defined Driver

If a specific request class should always use a different driver, define it inside the request:

```typescript
import { BaseRequest, FetchDriver, JsonResponse, RequestMethodEnum, XMLHttpRequestDriver } from '@blueprint-ts/core/requests'

BaseRequest.getDefaultClient().setDriver(new FetchDriver())

class UploadAvatarRequest extends BaseRequest<boolean, { message: string }, { ok: true }, JsonResponse<{ ok: true }>> {
  public method(): RequestMethodEnum {
    return RequestMethodEnum.POST
  }

  public url(): string {
    return '/api/v1/avatar'
  }

  public getResponse(): JsonResponse<{ ok: true }> {
    return new JsonResponse<{ ok: true }>()
  }

  protected override getRequestDriver() {
    return new XMLHttpRequestDriver({
      corsWithCredentials: true,
      headers: {
        'X-XSRF-TOKEN': () => getCookie('XSRF-TOKEN')
      }
    })
  }
}
```

The upload request uses its selected driver; other requests use their client's driver.

Request-defined drivers do not inherit configuration from the client's driver instance. If your
upload request needs credential support or shared headers, configure them on the `XMLHttpRequestDriver` you return from
`getRequestDriver()`.

## Per-Instance Driver

Use `setRequestDriver()` to select the transport for one request instance:

```typescript
import { FetchDriver, MockRequestDriver } from '@blueprint-ts/core/requests'

BaseRequest.getDefaultClient().setDriver(new FetchDriver())

const request = new UserShowRequest()
request.setRequestDriver(new MockRequestDriver())
```

Use this override in tests that need a mock transport for one request instance.

## Custom Driver

To implement your own driver, implement `RequestDriverContract` and return a `ResponseHandlerContract`:

```typescript
import { type RequestDriverContract } from '@blueprint-ts/core/requests'
import { type ResponseHandlerContract } from '@blueprint-ts/core/requests'
import { type RequestMethodEnum } from '@blueprint-ts/core/requests'
import { type HeadersContract } from '@blueprint-ts/core/requests'
import { type BodyContract } from '@blueprint-ts/core/requests'
import { type DriverConfigContract } from '@blueprint-ts/core/requests'

class CustomDriver implements RequestDriverContract {
  public async send(
    url: URL | string,
    method: RequestMethodEnum,
    headers: HeadersContract,
    body?: BodyContract,
    requestConfig?: DriverConfigContract
  ): Promise<ResponseHandlerContract> {
    // Implement your transport here and return a ResponseHandlerContract.
    throw new Error('Not implemented')
  }
}
```

Register your driver during app boot:

```typescript
BaseRequest.getDefaultClient().setDriver(new CustomDriver())
```

## Testing

For request mocking and assertions in tests, see [Testing](/services/requests/testing). `MockRequestDriver` supports:

- strict ordered matching by default
- opt-in unordered matching
- predicate-based request matchers for headers, query params, and JSON bodies
- capture-then-assert flows through request history
- convenience response builders such as `jsonResponse(...)` and `validationError(...)`
- global install/reset helpers and per-instance driver overrides

## Driver precedence and test isolation

A per-instance `setRequestDriver()` override has highest priority. Next comes the client's mock transport override, then a request-defined driver, then the client's driver. A mock installed with `installMockRequestDriver()` therefore covers request-defined upload drivers while retaining their request lifecycle and body serialization. Explicit per-instance drivers need their own verification.

Transport defaults belong to the driver; client headers and configuration apply across transports. A custom driver's `send()` receives an absolute URL string and must honor the `URL | string` contract.
