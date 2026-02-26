# Bulk Requests

Bulk requests let you send many requests together with a shared execution mode and retry policy.

## Basic Usage

Wrap each request in a `BulkRequestWrapper`, then send them with `BulkRequestSender`:

```typescript
import {
    BulkRequestExecutionMode,
    BulkRequestSender,
    BulkRequestWrapper,
    BulkRequestEventEnum
} from '@blueprint-ts/core/service/bulkRequests'

const requests = items.map((item) =>
    new BulkRequestWrapper(new DeleteRequest(item.id))
)

const sender = new BulkRequestSender(requests, BulkRequestExecutionMode.PARALLEL, 1)

await sender
    .on(BulkRequestEventEnum.REQUEST_SUCCESSFUL, () => {
        // handle success
    })
    .on(BulkRequestEventEnum.REQUEST_FAILED, () => {
        // handle failure
    })
    .send()
```

## Wrapper State

`BulkRequestWrapper` tracks per-request state so you can inspect individual results:

- `wasSent()`
- `hasError()`
- `getError()`
- `getResponse()`

## Sequential vs Parallel

- `BulkRequestExecutionMode.PARALLEL` sends all requests at once.
- `BulkRequestExecutionMode.SEQUENTIAL` sends requests one after another.

## Retries

Pass a retry count to the sender to retry failed requests:

```typescript
const sender = new BulkRequestSender(requests, BulkRequestExecutionMode.SEQUENTIAL, 2)
```

## Results

`send()` resolves with a summary object:

- `getSuccessCount()`
- `getErrorCount()`
- `getSuccessfulResponses()`
- `getFailedResponses()`

## Reusing a Sender

You can reuse a sender instance with a new set of requests:

```typescript
sender.setRequests(nextRequests)
```
