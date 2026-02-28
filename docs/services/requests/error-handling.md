# Error Handling

When a request fails, `BaseRequest.send()` routes error responses through the request error handler and throws a typed exception.

## Flow Overview

- The request driver throws a `ResponseException` when it receives a non-OK response.
- `BaseRequest.send()` catches that `ResponseException` and delegates to `ErrorHandler`.
- `ErrorHandler` parses the response body with `response.json()` into the request's `ResponseErrorBody` generic.
- If the parsed body is `undefined`, `NoResponseReceivedException` is thrown.
- Otherwise, the handler maps the HTTP status to a specific exception and throws it.
- If the error is not a `ResponseException`, `BaseRequest.send()` rethrows the original error.

## Catching Errors

When using request concurrency (see [Concurrency](/services/requests/concurrency)), `BaseRequest` can throw a `StaleResponseException` for outdated responses. These should usually be ignored:

```typescript
import { StaleResponseException } from '@blueprint-ts/core/requests'

try {
    await request.send()
} catch (error: unknown) {
    if (error instanceof StaleResponseException) {
        return
    }

    throw error
}
```

- `400` -> `BadRequestException`
- `401` -> `UnauthorizedException`
- `403` -> `ForbiddenException`
- `404` -> `NotFoundException`
- `405` -> `MethodNotAllowedException`
- `408` -> `RequestTimeoutException`
- `409` -> `ConflictException`
- `410` -> `GoneException`
- `412` -> `PreconditionFailedException`
- `413` -> `PayloadTooLargeException`
- `415` -> `UnsupportedMediaTypeException`
- `419` -> `PageExpiredException`
- `422` -> `ValidationException`
- `423` -> `LockedException`
- `429` -> `TooManyRequestsException`
- `500` -> `ServerErrorException`
- `501` -> `NotImplementedException`
- `502` -> `BadGatewayException`
- `503` -> `ServiceUnavailableException`
- `504` -> `GatewayTimeoutException`
- Any other status -> `ResponseException`

All mapped exceptions extend `ResponseBodyException`, so they provide both `getResponse()` and `getBody()` accessors. `ResponseException` only exposes `getResponse()`.
Error handling assumes error responses are JSON; if JSON parsing fails, an `InvalidJsonException` is thrown before status mapping runs.

When handling errors, treat the caught error as `unknown` and narrow with `instanceof`:

```typescript
import {
    ResponseException,
    ValidationException,
    UnauthorizedException
} from '@blueprint-ts/core/requests/exceptions'

try {
    await request.send()
} catch (error: unknown) {
    if (error instanceof ValidationException) {
        const response = error.getResponse()
        const body = error.getBody()
        // Handle validation errors using response/body.
    } else if (error instanceof UnauthorizedException) {
        const response = error.getResponse()
        const body = error.getBody()
        // Handle auth errors using response/body.
    } else if (error instanceof ResponseException) {
        const response = error.getResponse()
        // Handle other response errors.
    }
}
```

If you prefer to avoid manual `instanceof` checks, use the fluent `RequestErrorRouter`:

```typescript
import { RequestErrorRouter } from '@blueprint-ts/core/requests'
import {
    ResponseException,
    ValidationException,
    UnauthorizedException
} from '@blueprint-ts/core/requests/exceptions'

try {
    await request.send()
} catch (error: unknown) {
    await new RequestErrorRouter()
        .on(ValidationException, (exception) => {
            const response = exception.getResponse()
            const body = exception.getBody()
            // Handle validation errors using response/body.
        })
        .on(UnauthorizedException, (exception) => {
            const response = exception.getResponse()
            const body = exception.getBody()
            // Handle auth errors using response/body.
        })
        .on(ResponseException, (exception) => {
            const response = exception.getResponse()
            // Handle other response errors.
        })
        .otherwise((exception) => {
            // Handle non-response errors or rethrow.
            throw exception
        })
        .handle(error)
}
```

Handlers run in the order they are registered. Register specific exceptions before base types like `ResponseException`.
`RequestErrorRouter.handle()` returns `true` when a handler ran and `false` when no handler matched, so you can rethrow or fall back if needed.

## Global Error Handling

You can register a global handler that runs before the normal error mapping:

```typescript
import { ErrorHandler } from '@blueprint-ts/core/requests'

ErrorHandler.registerHandler((response) => {
    // Inspect response here.
    // Return false to indicate that normal handling should be skipped.
})
```

Note: the handler only aborts when it explicitly returns `false`. Returning `true`, `undefined`, or nothing continues normal error mapping.

Example: redirect to login on `401` responses:

```typescript
import { ErrorHandler } from '@blueprint-ts/core/requests'
import { type ResponseHandlerContract } from '@blueprint-ts/core/requests'

ErrorHandler.registerHandler((response: ResponseHandlerContract) => {
    if (response.getStatusCode() !== 401) {
        return
    }
    
    auth.logout()

    router.push({ name: 'login' })
})
```
