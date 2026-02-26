# Updating Rows

All paginators (including `InfiniteScroller`) inherit `updateRows` from `BasePaginator`. It lets you update items in the
current page data without reloading.

## Usage

`updateRows` accepts:

- a predicate to select rows
- an updater to mutate or replace them

```typescript
// Mark a single item as selected
paginator.updateRows(
    (row) => row.id === targetId,
    (row) => {
        row.selected = true
    }
)

// Replace matching items with new objects
paginator.updateRows(
    (row) => row.status === 'draft',
    (row) => ({ ...row, status: 'published' })
)
```

It returns the number of rows updated:

```typescript
const updated = paginator.updateRows(
    (row) => row.id === targetId,
    (row) => ({ ...row, updatedAt: new Date().toISOString() })
)
```
