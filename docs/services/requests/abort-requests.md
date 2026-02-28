# Aborting Requests

Requests can be aborted by passing an `AbortSignal` to the request.

If you want the request library to abort previous in-flight requests automatically, see [Concurrency](/services/requests/concurrency).

## Using AbortController

```typescript
const controller = new AbortController()

const request = new ExpenseIndexRequest()
  .setAbortSignal(controller.signal)

const promise = request.send()

// Later, when you want to abort:
controller.abort()
```

Note: If you enable request concurrency with `REPLACE` or `REPLACE_LATEST`, the request will assign its own abort signal and override this one. See [Concurrency](/services/requests/concurrency) for details.

## Bulk Requests

`BulkRequestSender` internally manages an `AbortController` for its requests. You can abort the entire bulk operation:

```typescript
bulkRequestSenderInstance.abort()
```
