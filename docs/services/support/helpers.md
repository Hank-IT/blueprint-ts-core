# Helpers

## isAtBottom

Detect whether a scroll container is at the bottom:

```typescript
import { isAtBottom } from '@blueprint-ts/core/service/support'

const atBottom = isAtBottom(scrollHeight, scrollTop, clientHeight)
```

Example with a scroll container:

```html
<nav class="overflow-y-auto" @scroll="handleScroll">
  <!-- content -->
</nav>
```

```typescript
import { isAtBottom } from '@blueprint-ts/core/service/support'

function handleScroll(event: Event): void {
    if (!(event.target instanceof Element)) {
        return
    }

    const atBottom = isAtBottom(event.target.scrollHeight, event.target.scrollTop, event.target.clientHeight)

    if (atBottom) {
        loadMore()
    }
}
```

## getCookie

Read a cookie value by name:

```typescript
import { getCookie } from '@blueprint-ts/core/service/support'

const token = getCookie('XSRF-TOKEN')
```

## isObject

Check if a value is a non-array object:

```typescript
import { isObject } from '@blueprint-ts/core/service/support'

if (isObject(value)) {
    // value is an object (not null, not an array)
}
```

## mergeDeep

Deep-merge plain objects:

```typescript
import { mergeDeep } from '@blueprint-ts/core/service/support'

const result = mergeDeep({}, defaults, overrides)
```

## getDisplayablePages

Generate a window of page numbers for pagination UI:

```typescript
import { getDisplayablePages } from '@blueprint-ts/core/service/support'

const pages = getDisplayablePages(currentPage, totalPages, displayPages)
```
