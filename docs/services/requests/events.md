# Events

Requests can emit lifecycle events via `BaseRequest.on(...)`.

## Available Events

- `RequestEvents.LOADING`: Emits `true` when a request starts and `false` when it finishes.

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
