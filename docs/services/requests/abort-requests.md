# Aborting Requests

Requests can be aborted by passing an `AbortSignal` to the request.

If you want the request library to abort previous in-flight requests automatically, see [Concurrency](/services/requests/concurrency).

## Using AbortController

```typescript
const controller = new AbortController()

const request = new ExpenseIndexRequest().setAbortSignal(controller.signal)

const promise = request.send()

// Later, when you want to abort:
controller.abort()
```

Caller cancellation also works with `REPLACE` and `REPLACE_LATEST`. Each send derives its signal from caller cancellation, concurrency replacement, and client disposal.

## Bulk Requests

`BulkRequestSender` internally manages an `AbortController` for its requests. You can abort the entire bulk operation:

```typescript
bulkRequestSenderInstance.abort()
```

## Keepalive requests

Use per-send options for a small cleanup request during page teardown:

```ts
await request.send({
  keepalive: true,
  detached: true,
  loading: false,
  globalErrorHandling: false,
  resolveBody: false
})
```

These options are independent. `keepalive` asks the transport to continue sending during navigation. `detached` excludes the send from caller cancellation, replacement concurrency, and client disposal. `loading: false` suppresses loading UI; `globalErrorHandling: false` suppresses shared response-error processing and failure notifications while retaining local handling and rejection. `resolveBody: false` skips response decoding.

`FetchDriver` supports keepalive; XHR rejects it with `UnsupportedTransportOptionException`. Browsers enforce limits on keepalive requests, including body size. Await the result when the page is staying open; during page teardown, handle rejection without blocking navigation. See [Drivers](./drivers) and [Testing](./testing) for configuration and transport assertions.
