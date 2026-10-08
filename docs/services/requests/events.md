# Events

Use the same typed subscription API for shared application behavior and individual requests:

```ts
const removeShared = client.on(RequestEvents.BEFORE_SERIALIZE, (snapshot, preparation) => {
  preparation.headers['X-Request-ID'] = snapshot.sendId
})
const removeLocal = request.on(RequestEvents.LOADING, (loading) => {
  console.log(loading) // boolean, inferred from the event
})
removeLocal()
removeShared()
```

`on()` returns an unsubscribe function. Each registration is independent, even when registering the same callback twice. Callback arguments are inferred from the event. The active subscriptions are captured at the start of each send. Shared subscriptions run before local subscriptions, in registration order.

| Event              | Arguments                                | Behavior                                                                                 |
| ------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `BEFORE_SERIALIZE` | snapshot, preparation                    | May change body and headers before serialization. Awaited sequentially.                  |
| `RESPONSE_ERROR`   | snapshot, raw error response             | Runs before error parsing. Awaited sequentially; `false` stops further processing.       |
| `RECEIVED`         | snapshot, response handler               | Processes successful response headers, including raw responses. Awaited sequentially.    |
| `DECODED`          | snapshot, decoded body, response handler | Processes decoded success data. Skipped with `resolveBody: false`. Awaited sequentially. |
| `FAILED`           | snapshot, error                          | Protected notification; cannot replace the original rejection.                           |
| `LOADING`          | boolean, snapshot                        | Protected notification covering preparation through response processing.                 |
| `UPLOAD_PROGRESS`  | progress, snapshot                       | Protected notification from supported transports, including XHR.                         |

A snapshot contains `requestId`, unique `sendId`, absolute `url`, `method`, and immutable typed `context`. Preparation contains a copied `body` and mutable `headers`. The decoded body is `unknown`; narrow it before using application-specific fields.

## Failure behavior

Preparation failures prevent dispatch. Response-processing failures reject the send. Processing listeners may return promises; later listeners wait for them, with stale/cancellation checks between stages. Synchronous preparation keeps transport dispatch synchronous, which is necessary for [page-close cleanup](./abort-requests#page-close-cleanup).

Exceptions and rejected promises from `FAILED`, `LOADING`, and `UPLOAD_PROGRESS` listeners go to the client's `onListenerError(error, event, snapshot)` reporter. They do not interrupt the request or replace its outcome. The default reporter is `console.error`. A throwing observer does not leak concurrency accounting or cancellation controllers.

`RESPONSE_ERROR` receives HTTP error responses before Blueprint parses their bodies. Returning `true` or nothing continues processing. Returning `false` stops subsequent response-error listeners, skips parsing and normalization, and suppresses shared `FAILED` notifications. The send still rejects with the original `ResponseException`, or a new one wrapping a response returned by the transport. Local `FAILED` listeners receive that same exception. A response-error listener that throws or rejects fails the send through the usual failure-notification path.

`globalErrorHandling: false` suppresses shared `RESPONSE_ERROR` handlers and shared `FAILED` notifications. Request-local listeners and rejection remain active. Stale and cancelled work skips failure side effects, including after asynchronous processing.

Fetch does not emit upload progress. XHR progress contains `loaded`, `total`, `lengthComputable`, and `progress` (between zero and one when computable).
