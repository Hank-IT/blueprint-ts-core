# Bulk Requests

Bulk requests let you send many requests together with a shared execution mode and retry policy.

## Basic Usage

Wrap each request in a `BulkRequestWrapper`, then send them with `BulkRequestSender`:

```typescript
import { BulkRequestExecutionMode, BulkRequestSender, BulkRequestWrapper, BulkRequestEventEnum } from '@blueprint-ts/core/bulkRequests'

const requests = items.map((item) => new BulkRequestWrapper(new DeleteRequest(item.id)))

const sender = new BulkRequestSender(requests, BulkRequestExecutionMode.PARALLEL)

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

- `getOutcome()`: `pending`, `running`, `succeeded`, `failed`, or `cancelled`
- `wasSent()`
- `hasError()`
- `getError()`
- `getResponse()`

## Sequential vs Parallel

- `BulkRequestExecutionMode.PARALLEL` sends all requests at once.
- `BulkRequestExecutionMode.SEQUENTIAL` sends requests one after another.

## Retries

Retries are disabled by default. An explicit retry count limits additional attempts; a retry policy must also explicitly approve each retry. The policy decides which failures are eligible, including any HTTP status. Cancelled operations and aborted batches are not retried. Ensure the operation can safely be retried before enabling retries:

```typescript
const sender = new BulkRequestSender(requests, BulkRequestExecutionMode.SEQUENTIAL, 2).setRetryPolicy((error) => isRetryableOperationError(error))
```

## Results

`send()` resolves with a summary object:

- `getSuccessCount()`
- `getErrorCount()`
- `getCancelledCount()`
- `getSuccessfulResponses()`
- `getFailedResponses()`
- `getCancelledResponses()`

## Reusing a Sender

You can reuse a sender instance with a new set of requests:

```typescript
sender.setRequests(nextRequests)
```

## Scheduling and cancellation

Use `setConcurrencyLimit(4)` to limit parallel execution. `setScheduling({ keys, beforeSend, succeeded, stopDependentsOnFailure })` serializes wrappers that share dependency keys while unrelated requests can run in parallel. `beforeSend` and `succeeded` are awaited, so an acknowledged revision can be passed to the next dependent write. Dependent work is cancelled after failure by default; set `stopDependentsOnFailure: false` only when it can proceed independently.

`abort()` cancels active requests and queued work. Cancelled requests have a separate outcome and count; they are not counted as successful or failed. Batch results are snapshots of that completed run, so reusing the sender cannot change an earlier result. Replacing requests or changing the concurrency limit during a running batch throws.

`setRetryPolicy((error, attempt) => boolean)` replaces the retry decision while retaining the configured retry limit. `attempt` starts at one after the first failed attempt.
