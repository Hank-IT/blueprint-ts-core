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

## Deprecated `Paginator` alias removed

`Paginator` (and the related `PaginatorOptions` alias) was an old alias for `PageAwarePaginator`. The alias file has been removed, so importing `Paginator` or `PaginatorOptions` now results in a build error.

### How to Fix

- Replace `import { Paginator } from '@blueprint-ts/core/pagination'` with:

```typescript
import { PageAwarePaginator } from '@blueprint-ts/core/pagination'
```

- Replace `import { type PaginatorOptions } from '@blueprint-ts/core/pagination'` with:

```typescript
import { type PageAwarePaginatorOptions } from '@blueprint-ts/core/pagination'
```

## Core Modules Moved out of `service/`

Core (non-framework) modules moved from `@blueprint-ts/core/service/*` to `@blueprint-ts/core/*`.

### How to Fix

Replace:

```typescript
import { BaseRequest } from '@blueprint-ts/core/service/requests'
import { PageAwarePaginator } from '@blueprint-ts/core/service/pagination'
import { DeferredPromise } from '@blueprint-ts/core/service/support'
import { BulkRequestSender } from '@blueprint-ts/core/service/bulkRequests'
import { LocalStorageDriver } from '@blueprint-ts/core/service/persistenceDrivers'
```

with:

```typescript
import { BaseRequest } from '@blueprint-ts/core/requests'
import { PageAwarePaginator } from '@blueprint-ts/core/pagination'
import { DeferredPromise } from '@blueprint-ts/core/support'
import { BulkRequestSender } from '@blueprint-ts/core/bulkRequests'
import { LocalStorageDriver } from '@blueprint-ts/core/persistenceDrivers'
```

## Helpers Moved to Support

Helpers are now exported from `@blueprint-ts/core/support`. The `@blueprint-ts/core/helpers` export was removed.

### How to Fix

Replace:

```typescript
import { isAtBottom } from '@blueprint-ts/core/helpers'
```

with:

```typescript
import { isAtBottom } from '@blueprint-ts/core/support'
```

## ConfirmDialogSeverity Is Now an Enum

`ConfirmDialogSeverity` was changed from a string union type to an enum. Update any `getSeverity()` implementations to return the enum value.

### How to Fix

Replace:

```typescript
import { type ConfirmDialogOptions } from '@blueprint-ts/core/vue'

export class MyConfirmOptions implements ConfirmDialogOptions {
  getSeverity() {
    return 'warning'
  }
}
```

with:

```typescript
import { type ConfirmDialogOptions, ConfirmDialogSeverity } from '@blueprint-ts/core/vue'

export class MyConfirmOptions implements ConfirmDialogOptions {
  getSeverity() {
    return ConfirmDialogSeverity.WARNING
  }
}
```

## Laravel Packages Moved

Laravel modules moved from `@blueprint-ts/core/service/laravel/*` to `@blueprint-ts/core/laravel/*`.

### How to Fix

Replace:

```typescript
import { JsonBaseRequest } from '@blueprint-ts/core/service/laravel/requests'
```

with:

```typescript
import { JsonBaseRequest } from '@blueprint-ts/core/laravel/requests'
```

## BaseForm `state` is now protected

`BaseForm.state` was public in previous versions, but it is now `protected readonly`. That means external consumers can no longer import form instances and access `form.state`. Subclasses can still read/write state internally, so any code that depended on reading it from outside the form must switch to supported accessors such as `form.properties`.

### How to Fix

- Replace direct `form.state` usage with the public helpers (`form.properties`, getters, or explicit payload builders).
- If you were creating helpers that accessed `state` from outside the form, move those helpers inside the form class so they can rely on the protected field.
