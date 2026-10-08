# Upgrading v5 to v6

Version 6 changes request execution, bulk results, pagination drivers, form state, and request testing.

## Migration overview

| Area                      | Required review                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Custom pagination drivers | Implement initialization state and remove access to `BasePaginator.initialized`.                                           |
| Bulk retries              | Supply an explicit retry policy as well as a retry count.                                                                  |
| Bulk results              | Report cancellation separately and use terminal outcomes to identify success.                                              |
| Request subclasses        | Replace removed concurrency internals and configuration-builder overrides with supported configuration and lifecycle APIs. |
| Request behavior          | Review loading duration, cancellation, body snapshots, header precedence, and error routing.                               |
| Forms                     | Review immediate dirty checks and the persisted draft shape.                                                               |
| Request tests             | Verify scopes and expectations; exercise serialization through real requests.                                              |
| Vue consumers             | Use Vue `^3.5.0` and Vue Router `^5.0.0` where installed.                                                                  |

## Dependency requirements

The package now declares optional peer dependencies on Vue `^3.5.0` and Vue Router `^5.0.0`. Request-only consumers do not need to install them. If either dependency is installed, its version must satisfy the declared range. Older Vue or Vue Router installations can cause package-manager dependency conflicts.

## Pagination initialization belongs to the view driver

`BaseViewDriverContract` now requires:

```ts
isInitialized(): boolean
setInitialized(value: boolean): void
```

Update every custom driver and test double implementing this contract or `ViewDriverContract`. Store an initial `false` value, expose it from `isInitialized()`, and update it in `setInitialized()`. Vue drivers should use reactive state so a successful empty first page also updates the UI.

`VueBaseViewDriver` and `VuePaginationDriver` already implement these methods. Existing consumers using the supplied factories require no custom driver changes.

The protected `BasePaginator.initialized` field has been removed. Custom paginator subclasses must call `this.viewDriver.setInitialized(true)` when applying a successful result. Continue to use the paginator's public `isInitialized()` for reads.

## Bulk retries require an explicit policy

In v5, a positive `retryCount` or `setRetryCount()` was sufficient to retry failures. In v6, both a positive count and `setRetryPolicy()` are required. Without a policy, a failed operation is attempted once.

For operations your application has established are safe to repeat, select the retryable errors explicitly:

```ts
import { ResponseException } from '@blueprint-ts/core/requests/exceptions'

sender.setRetryCount(2).setRetryPolicy((error) => {
  return error instanceof ResponseException && error.getResponse().getStatusCode() === 503
})
```

The policy receives the error and the one-based failed-attempt number. The retry count is the maximum number of additional attempts. The policy controls eligibility for every HTTP status. Cancelled operations and aborted batches are not retried.

Retries now finish within each operation. In sequential mode, an eligible retry of operation A happens before operation B starts; v5 made an initial pass across the batch before retrying failures. Each attempt clears the wrapper's previous error and response, so a successful retry is reported as success.

## Bulk outcomes, cancellation, and lifecycle

`BulkRequestWrapper.getOutcome()` returns `pending`, `running`, `succeeded`, `failed`, or `cancelled`. Check for `succeeded` when deciding whether to perform success side effects. `!hasError()` alone cannot establish success because pending work has no error.

Cancellation has its own result accessors and event:

```ts
import { BulkRequestEventEnum } from '@blueprint-ts/core/bulkRequests'

sender.on(BulkRequestEventEnum.REQUEST_CANCELLED, (wrapper) => {
  console.debug('Operation cancelled', wrapper.getError())
})

const result = await sender.send()
const totals = {
  succeeded: result.getSuccessCount(),
  failed: result.getErrorCount(),
  cancelled: result.getCancelledCount()
}
```

`getErrorCount()` and `getFailedResponses()` exclude cancellations. Update progress summaries, notifications, and cleanup handlers that previously treated these as all unsuccessful operations. Cancelled work emits `REQUEST_CANCELLED`, not `REQUEST_FAILED`. Unsent work never counts as success.

Other changes affect existing bulk callers:

- `isLoading` covers scheduling, requests, retries, and success processing for the entire batch. It no longer derives a boolean from individual request loaders.
- Calling `send()` again while a batch is running rejects. `setRequests()` and changing the concurrency limit during a running batch throw.
- Result counts and response arrays describe the completed invocation; reusing the sender does not change an earlier result.
- Failure events are emitted when each operation finishes, rather than after the whole batch's retry phase.
- `wasSent()` becomes true when an attempt starts, not only when it completes. Use the outcome to check completion.
- Exceptions from custom scheduling or event code can cause `send()` to reject. Keep promise rejection handling even when inspecting per-operation results.

Parallel execution remains the default. `setConcurrencyLimit(n)` bounds concurrent operations. The optional `setScheduling({ keys, beforeSend, succeeded })` API orders requests sharing keys while independent requests can run concurrently. The next dependent operation starts after successful response processing finishes. A failed or cancelled dependency cancels subsequent operations sharing its keys by default; `stopDependentsOnFailure: false` explicitly changes that policy.

## Configure one request client at startup

Create a `RequestClient` before constructing requests and install it with `BaseRequest.setDefaultClient(client)`. A request captures this client when constructed. Replacing the default only affects subsequently constructed requests. Use the constructor's client parameter or `setClient(client)` for an explicit client; changing a request's client while it is active throws.

The client owns the base URL, transport, shared headers/configuration, loader factory, subscriptions, and concurrency accounting. Clients isolate APIs and test lifetimes. Move the removed static configuration APIs to the client:

| Removed API                                    | Replacement                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| `BaseRequest.setDefaultBaseUrl(url)`           | `client.setBaseUrl(url)` or constructor `baseUrl`                                    |
| `BaseRequest.setRequestDriver(driver)`         | `client.setDriver(driver)` or constructor `driver`                                   |
| `BaseRequest.setRequestLoaderFactory(factory)` | `client.setLoaderFactory(factory)` or constructor `loaderFactory`                    |
| `ErrorHandler.registerHandler(handler)`        | `client.on(RequestEvents.RESPONSE_ERROR, (_request, response) => handler(response))` |

<<< ../examples/v6.ts#startup

Remove requests constructed at module import time before startup. Construct them in the view, service operation, or test that owns their lifetime.

## One typed event API

`request.on(event, handler)` and `client.on(event, handler)` use the same event types. Both return an unsubscribe function, so they are no longer fluent request builders. Remove caller-provided payload generics such as `on<RequestUploadProgress>(...)`; the event determines callback arguments.

Replace the exported `EventHandlerCallback<T>` type with `RequestEventHandler<Event>`. Subclasses can no longer access the old protected `events` collection or `dispatch()` method; subscribe through `on()`.

Shared listeners run before request listeners, in registration order. Each send captures its subscriptions. Unsubscribing or registering during a send affects future sends.

`BEFORE_SERIALIZE`, `RECEIVED`, and `DECODED` are processing stages: their callbacks run sequentially and returned promises are awaited. Preparation failures prevent dispatch, and response processing failures reject the send. `RECEIVED` includes raw responses; `DECODED` does not run with `resolveBody: false`.

`RESPONSE_ERROR` runs before error-body parsing, with the request snapshot and raw response. It supports asynchronous handlers and `return false` to stop further response-error processing. Move status-based handlers here so empty or non-JSON bodies do not prevent them from running.

`FAILED`, `LOADING`, and `UPLOAD_PROGRESS` are notifications. Their synchronous throws and promise rejections go to the client's `onListenerError` reporter without changing request results or leaving loading active. `FAILED` receives the rejected error, normalized unless response-error processing stopped it. Stale and cancelled sends skip failure side effects. See [events](/services/requests/events) for callback signatures and error semantics.

## Request subclass extension points

`BaseRequestContract` includes client selection, typed subscriptions, `setContext()`/`getContext()`, and `setRequestDriver(driver): this`. Custom implementations must provide these contracts. Subclasses inherit them. Prefer real request classes with a mock transport in tests instead of partial contract doubles.

Concurrency accounting is internal. The protected `bumpConcurrencySequence()`, `isLatestSequence()`, `incrementConcurrencyInFlight()`, and `decrementConcurrencyInFlight()` methods have been removed. `buildRequestConfig()` is private. Remove those overrides and use `setConcurrency()`, `getConfig()`/`send()` options, and lifecycle subscriptions. Retain `super.getConfig()` in an override so attached abort signals are preserved.

## Changes to ordinary request behavior

These changes apply even without registering hooks:

- **Loading:** loading remains active until response decoding and processing finish. Previously it ended after transport completion. Loading events also close correctly if serialization fails.
- **Cancellation and stale results:** each send uses its own cancellation controller. External signals are forwarded without replacing the caller's stored signal. Cancellation and latest-response checks run after decoding and asynchronous hooks as well as after transport completion, so an obsolete result may now reject where v5 returned it. Custom transports receive the derived signal; do not depend on its object identity matching the caller's signal.
- **Body snapshots:** each send snapshots supported body values before preparation and serialization. Plain objects, arrays, dates, regular expressions, maps, sets, buffers, typed-array views, URL, and URLSearchParams are copied. Immutable Blob/File values retain their identity; FormData gets an independent entry snapshot, including duplicate keys and files. Custom class instances and functions retain their identity so factories can use their methods and private fields. Those retained objects remain shared during asynchronous preparation. See [Request Bodies](/services/requests/request-bodies).
- **Headers:** driver defaults are overridden by request headers, then by `requestConfig.headers`, then by body headers such as `Content-Type`. Fetch and XHR now honor `requestConfig.headers`, which v5 ignored.
- **Driver URLs:** `BaseRequest` passes an absolute URL string to the driver. Custom drivers must honor the existing `URL | string` contract instead of assuming they always receive a `URL` object.
- **Error logging:** the request and bulk layers no longer automatically log every rejected operation to `console.error`. Handle or log errors in the application's chosen error handler or lifecycle hook.

## HTTP error routing preserves response bodies

HTTP 428 now throws `PreconditionRequiredException`. Other statuses without a dedicated exception throw `ResponseBodyException`, retaining the parsed JSON body. Both still extend `ResponseException`, so base-class catches remain valid. Existing status-specific exceptions and malformed/absent JSON handling remain in place.

Review exact-constructor checks and `RequestErrorRouter` handler ordering: a generic `ResponseBodyException` handler can now match statuses it previously did not. Register more specific handlers first.

Error normalization runs once unless a `RESPONSE_ERROR` handler returns `false`. Returning `false` stops later response-error handlers, skips normalization and shared `FAILED` notifications, and preserves rejection with a `ResponseException`. This matches the v5 built-in Fetch path's rejection behavior and makes it consistent for custom transports that return error responses. Request-local `FAILED` listeners and the caller's catch still run. `FAILED` itself remains a notification whose return value cannot change the result. `globalErrorHandling: false` suppresses shared listeners for both error events while retaining local handling and rejection.

## Form baselines and dirty state

`isDirty()` now compares values with the baseline immediately, including nested changes before watchers flush. Code that relied on a delayed dirty update must account for the immediate result. Blob/File values retain their content through snapshots and resets.

Use `acceptSavedValues()` after a successful save to accept the current values as the baseline. Optionally pass the complete saved form state to replace the current values as well, mapping a response when its shape differs from editable values. The baseline is reactive, so computed dirty indicators update immediately even when accepting values does not change the current fields. This also clears touched state. See [Saving Form Values](/vue/forms/saving).

## Persisted draft shape

`PersistedForm` no longer contains cached `dirty` flags. It contains `state`, `original`, and `touched`; dirty state is recomputed from values. Update custom persistence drivers and restore policies that construct or inspect this object.

Drafts remain unversioned. Structural validation requires state and original objects containing only declared constructor fields, plus boolean touched flags for every declared field. JSON-omitted values are restored as `undefined`; baseline comparison treats omitted and explicitly undefined object properties equally. Include optional fields in constructor values even when their initial value is undefined. Malformed drafts are discarded before a custom restore policy runs. The default restore policy requires the original baseline to match constructor values; custom policies can choose another rule for structurally valid drafts. See [Persistence](/vue/forms/persistence).

## Strict request testing

Use a scope for each test and dispose it in teardown:

```ts
import { afterEach, beforeEach } from 'vitest'
import { RequestClient, createMockRequestScope } from '@blueprint-ts/core/requests'

let scope: ReturnType<typeof createMockRequestScope>
beforeEach(() => {
  scope = createMockRequestScope({ client: new RequestClient({ baseUrl: 'https://example.test' }) })
})
afterEach(() => scope.dispose())
```

`createRequestScope()` also verifies mock transports installed on its client and aborts unfinished ordinary sends. Disposing a default scope restores the previous default client. Requests already constructed retain their captured client. Use the application client factory in tests so production listeners run. Dispose nested scopes in reverse order. If you construct a mock driver directly, call its `assertExpectationsMet()` in teardown.

Update tests for these behavior changes:

- Unexpected-request failures remain recorded after application code catches them. Final verification still fails.
- `resetMockRequestDriver()` verifies the current driver before clearing it. It can no longer silently discard unmet expectations or mismatches.
- Request history includes attempted mismatches and driver configuration, including keepalive and cancellation options. Update exact history assertions accordingly.
- Deferred mock responses obey abort signals. Use `deferredResponse()` to exercise completion, cancellation, and races through real request classes.
- `MockRequestExpectation.response` can now be a response definition or callback. Code inspecting this field must narrow its type before reading response-definition properties.

Use `expect()`/`expectAny()` for required traffic and `allow(criteria, response, { maxCalls })` for narrowly matched optional traffic. Required expectations take priority. Match validation headers explicitly so a validation request cannot consume a save expectation. Exercise real request classes through the mock transport so serialization and lifecycle listeners run.

Test the complete read → edit → save path, including failed writes and repeated saves. For uploads, assert the binary bytes or multipart entries reaching the transport through `BaseRequest.send()`; checking a body factory in isolation cannot verify request snapshots.

## Opt-in keepalive cleanup

Fetch keepalive is disabled by default. Driver defaults, `getConfig()` options, and per-send options are supported; an explicit per-send `false` wins. XHR rejects enabled keepalive with `UnsupportedTransportOptionException`. Mock drivers record the setting in request history.

An existing request class can perform authenticated page-close cleanup:

```ts
void cleanupRequest
  .send({
    keepalive: true,
    detached: true,
    loading: false,
    globalErrorHandling: false,
    resolveBody: false
  })
  .catch((error) => console.debug('Cleanup delivery failed', error))
```

These options are independent. `detached` excludes the send from external abort signals, replacement concurrency, and scope cancellation. `loading: false` suppresses loading UI, and `globalErrorHandling: false` suppresses global error side effects while preserving local rejection. `resolveBody: false` skips decoding, including for empty responses. URL resolution, credentials, dynamic headers, serialization, and application lifecycle hooks still apply.

Synchronous preparation dispatches the transport synchronously. Avoid asynchronous preparation hooks for page-close requests. Browser payload quotas, network failure, and shutdown still apply: keep payloads small and treat cleanup delivery as best effort.

## Validate the upgrade

1. Update custom drivers and subclasses, then run the consumer's type checks.
2. Review bulk retry policies, cancellation reporting, and terminal-event handlers.
3. Exercise first-page pagination with an empty result and form save/dirty behavior across consecutive saves.
4. Test JSON, Blob/File, and multipart uploads through the real request pipeline for each transport in use.
5. Verify conflict/precondition failures are not automatically retried or used to replace captured metadata.
6. Run scoped request tests through real request classes, then validate a clean installation of the released package.
