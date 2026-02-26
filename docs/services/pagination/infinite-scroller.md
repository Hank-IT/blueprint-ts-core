# Infinite Scroll

Use `InfiniteScroller` when you want to append pages to the existing list:

```typescript
import { InfiniteScroller } from '@blueprint-ts/core/pagination'

const scroller = new InfiniteScroller(dataDriver, 1, 10)

await scroller.load()
await scroller.toNextPage()
```

`InfiniteScroller` uses the same view driver factory as `PageAwarePaginator`. You can pass `{ flush: true }` or
`{ replace: true }` to `load()` or `setPageNumber()` to control how data is merged.

## Scroll Detection Helper

See the Support Helpers docs for `isAtBottom` usage.
