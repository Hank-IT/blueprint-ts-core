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

## Removing Rows

Use `removeRows` to delete items from the current page data without reloading. By default it also decrements `total`
by the number of removed rows. Set `adjustTotal: false` to skip that behavior.

```typescript
// Remove a single item
const removed = paginator.removeRows((row) => row.id === targetId)

// Remove all drafts without adjusting total
const removedDrafts = paginator.removeRows(
    (row) => row.status === 'draft',
    { adjustTotal: false }
)
```
