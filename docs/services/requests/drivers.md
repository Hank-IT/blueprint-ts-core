# Drivers

Requests are executed by a request driver. The library includes a default fetch-based driver and lets you provide your
own by implementing `RequestDriverContract`.

## Default Fetch Driver

```typescript
import { BaseRequest, FetchDriver } from '@blueprint-ts/core/requests'

BaseRequest.setRequestDriver(new FetchDriver())
```

The `FetchDriver` supports:

- Global headers
- `corsWithCredentials` configuration
- `AbortSignal` via request config

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
