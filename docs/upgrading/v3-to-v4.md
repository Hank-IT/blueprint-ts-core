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
