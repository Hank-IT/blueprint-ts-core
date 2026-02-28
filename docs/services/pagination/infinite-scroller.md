# Infinite Scroll

Use `InfiniteScroller` when you want to append pages to the existing list. It extends `PageAwarePaginator`, so all
page-aware features and helpers are available.

```typescript
import { InfiniteScroller } from '@blueprint-ts/core/pagination'

const scroller = new InfiniteScroller(dataDriver, 1, 10)

await scroller.load()
await scroller.toNextPage()
```

You can pass `{ flush: true }` to clear existing data before loading a page. In addition, `InfiniteScroller` supports
`{ replace: true }` to replace the current list instead of appending.

## Scroll Detection Helper

See the Support Helpers docs for `isAtBottom` usage.
