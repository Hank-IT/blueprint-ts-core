# Upgrading v3 to v4

This guide covers breaking changes when upgrading from v3 to v4.

## Bulk Request Sender Is Now Generic

`BulkRequestSender` is now a generic class, and `setRequests()` expects wrappers with matching type parameters. If you
instantiated the sender without generics, TypeScript may report type errors when passing typed request wrappers.

### What Changed

- `BulkRequestSender` is now generic over:
  - `RequestLoaderLoadingType`
  - `RequestBodyInterface`
  - `ResponseClass`
  - `RequestParamsInterface`
- `setRequests()` is now typed to accept wrappers with the same generics.

### How to Fix

Add generics when creating the sender so it matches your wrapper types:

```typescript
const bulkRequestSenderInstance = new BulkRequestSender<
    RequestLoaderLoadingType,
    RequestBodyInterface,
    ResponseClass,
    RequestParamsInterface
>([], bulkRequestExecutionMode, retryCount)
```

If you already have typed wrappers, TypeScript will infer the rest once the sender is typed.

## Paginator `init()` Was Removed

Pagination now marks a paginator as initialized only after the first successful load. The `init()` method was removed
in favor of `load()`.

### What Changed

- `isInitialized()` now becomes `true` only after a successful data load.
- `init()` no longer exists.

### How to Fix

Replace `init(...)` with `load(...)`:

```typescript
await paginator.load()
```

## Paginator `refresh()` Was Removed

`refresh()` was removed in favor of `load()` to make the first load more intuitive.

### How to Fix

Replace `refresh(...)` with `load(...)`:

```typescript
await paginator.load()
```

## Pagination Setters No Longer Trigger Loads

`setPageNumber()` and `setPageSize()` now only update state. Call `load()` to fetch data:

```typescript
await paginator.setPageNumber(2).load()
await paginator.setPageSize(50).load()
```

`setPage()` was renamed to `setPageNumber()`.
Page navigation helpers (`toNextPage`, `toPreviousPage`, `toFirstPage`, `toLastPage`) still load the new page in one call.

## PaginationParamsContract Was Removed

`PaginationParamsContract` was removed from the Laravel pagination exports because it was unused. Define your own params
interface in your app instead.
