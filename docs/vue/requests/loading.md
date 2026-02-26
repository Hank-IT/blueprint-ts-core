# Loading

For Vue apps, the library includes `VueRequestLoader`, `VueRequestLoaderFactory`, and `VueRequestBatchLoader`, which
use Vue refs to track loading state.

## Registering the Vue Loader Factory

```typescript
import { BaseRequest } from '@blueprint-ts/core/requests'
import { VueRequestLoaderFactory } from '@blueprint-ts/core/vue/requests'

BaseRequest.setRequestLoaderFactory(new VueRequestLoaderFactory())
```

## Reading Loading State

```typescript
const request = new ExpenseIndexRequest()

request.send()

const isLoading = request.isLoading()
// isLoading is a Ref<boolean> when using VueRequestLoaderFactory
```

## Batch Loading

`VueRequestBatchLoader` can track the loading state of multiple requests. Use it when you want a single loading ref to
reflect a batch of requests.

```typescript
import { VueRequestBatchLoader } from '@blueprint-ts/core/vue/requests'

const batchLoader = new VueRequestBatchLoader(2)
batchLoader.startBatch(2)

const requestA = new ExpenseIndexRequest().setRequestLoader(batchLoader)
const requestB = new ExpenseIndexRequest().setRequestLoader(batchLoader)

requestA.send()
requestB.send()

const isLoading = batchLoader.isLoading()
```

If the batch will not complete (for example, when a chained request fails), call `abortBatch()` to stop waiting for the
remaining requests:

```typescript
batchLoader.abortBatch()
```
