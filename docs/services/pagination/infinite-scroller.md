# Infinite Scroll

Use `InfiniteScroller` when you want to append pages to the existing list:

```typescript
import { InfiniteScroller } from '@blueprint-ts/core/service/pagination'

const scroller = new InfiniteScroller(dataDriver, 1, 10)

await scroller.load()
await scroller.toNextPage()
```

`InfiniteScroller` uses the same view driver factory as `PageAwarePaginator`. You can pass `{ flush: true }` or
`{ replace: true }` to `load()` or `setPageNumber()` to control how data is merged.

## Scroll Detection Helper

To detect when the user has scrolled to the bottom, use the `isAtBottom` helper:

```typescript
import { isAtBottom } from '@blueprint-ts/core/helpers'

const atBottom = isAtBottom(event.target.scrollHeight, event.target.scrollTop, event.target.clientHeight)
```

Example with a scroll container:

```html
<nav class="overflow-y-auto" @scroll="handleScroll">
  <!-- content -->
</nav>
```

```typescript
import { isAtBottom } from '@blueprint-ts/core/helpers'

function handleScroll(event: Event): void {
    if (!(event.target instanceof Element)) {
        return
    }

    const atBottom = isAtBottom(event.target.scrollHeight, event.target.scrollTop, event.target.clientHeight)

    if (atBottom) {
        void scroller.toNextPage()
    }
}
```
