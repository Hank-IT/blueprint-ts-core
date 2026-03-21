# Events

Requests can emit lifecycle events via `BaseRequest.on(...)`.

## Available Events

- `RequestEvents.LOADING`: Emits `true` when a request starts and `false` when it finishes.
- `RequestEvents.UPLOAD_PROGRESS`: Emits upload progress for drivers that support it, such as `XMLHttpRequestDriver`.

## Loading Event

Use the `RequestEvents.LOADING` event to track request loading state:

```typescript
import { RequestEvents } from '@blueprint-ts/core/requests'

const request = new ExpenseIndexRequest()

request.on(RequestEvents.LOADING, (isLoading: boolean) => {
    // Handle loading state
})

request.send()
```

You can also pass the event payload type explicitly via the generic:

```typescript
request.on<boolean>(RequestEvents.LOADING, (isLoading) => {
    // isLoading is typed as boolean
})
```

## Upload Progress Event

Use `RequestEvents.UPLOAD_PROGRESS` to drive file upload progress indicators:

```typescript
import { RequestEvents, type RequestUploadProgress } from '@blueprint-ts/core/requests'

request.on<RequestUploadProgress>(RequestEvents.UPLOAD_PROGRESS, (progress) => {
    console.log(progress.loaded, progress.total, progress.progress)
})
```

The payload contains:

- `loaded`: Bytes uploaded so far.
- `total`: Total bytes when the browser can compute it.
- `lengthComputable`: Whether `total` is reliable.
- `progress`: A normalized value between `0` and `1` when `total` is known.

Note: The default `FetchDriver` does not emit upload progress. Use `XMLHttpRequestDriver` for upload progress support.
