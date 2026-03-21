# Drivers

Requests are executed by a request driver. The library includes a `FetchDriver`, an `XMLHttpRequestDriver`, and also
lets you provide your own by implementing `RequestDriverContract`.

## Fetch Driver

```typescript
import { BaseRequest, FetchDriver } from '@blueprint-ts/core/requests'

BaseRequest.setRequestDriver(new FetchDriver())
```

The `FetchDriver` supports:

- Global headers
- `corsWithCredentials` configuration
- `AbortSignal` via request config

## XMLHttpRequest Driver

Use `XMLHttpRequestDriver` when you need upload progress events for file uploads:

```typescript
import { BaseRequest, XMLHttpRequestDriver } from '@blueprint-ts/core/requests'

BaseRequest.setRequestDriver(new XMLHttpRequestDriver())
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
import {
    BaseRequest,
    FetchDriver,
    JsonResponse,
    RequestMethodEnum,
    XMLHttpRequestDriver
} from '@blueprint-ts/core/requests'

BaseRequest.setRequestDriver(new FetchDriver())

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

This keeps the driver choice encapsulated inside the request class while still allowing the application to keep a
global default driver for everything else.

Important: request-defined drivers do not inherit configuration from the globally registered driver instance. If your
upload request needs credential support or shared headers, configure them on the `XMLHttpRequestDriver` you return from
`getRequestDriver()`.

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
BaseRequest.setRequestDriver(new CustomDriver())
```
