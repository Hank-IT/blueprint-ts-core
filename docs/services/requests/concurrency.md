# Request Concurrency

Concurrent requests can cause two common problems:

1. A slower, older response overwrites newer data ("stale results").
2. Loading state flickers because earlier requests finish after later ones.

To solve this, `BaseRequest` supports an optional concurrency policy that can abort older requests and/or ignore stale responses.

## Basic Usage

```typescript
import { RequestConcurrencyMode } from '@blueprint-ts/core/requests'

const request = new ExpenseIndexRequest()

request.setConcurrency({
  mode: RequestConcurrencyMode.REPLACE_LATEST,
  key: 'expense-search'
})

request.send()
```

## Modes

- `ALLOW` (default): no aborts and no stale-response filtering.
- `REPLACE`: aborts any in-flight request with the same key.
- `LATEST`: ignores stale responses; only the most recent response is applied.
- `REPLACE_LATEST`: aborts older requests and ignores stale responses.

## Abort Signals

Each send has its own abort controller. Caller cancellation, replacement, and client disposal are forwarded to that controller. The caller’s signal remains effective in every concurrency mode. Aborting one send does not overwrite another send’s signal.

## Keys

The `key` coordinates requests captured by the same `RequestClient`. Separate clients have independent keys, replacement controllers, and loading counts. If you omit it, the request instance ID is used.

Use a shared key when multiple instances represent the same logical request stream (for example, a search box that creates new request objects).

## Stale Responses

When `LATEST` or `REPLACE_LATEST` is used, stale responses raise a `StaleResponseException` so the caller can ignore them safely. Blueprint checks freshness after asynchronous preparation, transport, response processing, and decoding. A replacement that arrives while a processing listener is waiting prevents the older result from reaching the caller.

If you don't want to handle it explicitly, catch and ignore it:

```typescript
import { StaleResponseException } from '@blueprint-ts/core/requests'

request.send().catch((error) => {
  if (error instanceof StaleResponseException) {
    return
  }

  throw error
})
```
