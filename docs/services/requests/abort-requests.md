# Aborting Requests

Requests can be aborted by passing an `AbortSignal` to the request.

## Using AbortController

```typescript
const controller = new AbortController()

const request = new ExpenseIndexRequest()
  .setAbortSignal(controller.signal)

const promise = request.send()

// Later, when you want to abort:
controller.abort()
```

## Bulk Requests

`BulkRequestSender` internally manages an `AbortController` for its requests. You can abort the entire bulk operation:

```typescript
bulkRequestSenderInstance.abort()
```
