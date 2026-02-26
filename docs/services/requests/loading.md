# Loading

Requests can expose loading state through a request loader. You register a loader factory once, and each `BaseRequest`
instance will ask the factory for a loader.

Note: For Vue apps, the library provides `VueRequestLoader` and `VueRequestLoaderFactory` in `@blueprint-ts/core/vue/requests`.

## Registering a Loader Factory

Use `BaseRequest.setRequestLoaderFactory()` to register a factory that implements `RequestLoaderFactoryContract` and
returns a `RequestLoaderContract`:

```typescript
import {
    BaseRequest,
    type RequestLoaderContract,
    type RequestLoaderFactoryContract
} from '@blueprint-ts/core/service/requests'

class BooleanLoader implements RequestLoaderContract<boolean> {
    private loading = false

    public isLoading(): boolean {
        return this.loading
    }

    public setLoading(value: boolean): void {
        this.loading = value
    }
}

class BooleanLoaderFactory implements RequestLoaderFactoryContract<boolean> {
    public make(): RequestLoaderContract<boolean> {
        return new BooleanLoader()
    }
}

BaseRequest.setRequestLoaderFactory(new BooleanLoaderFactory())
```

## Reading Loading State

Once a loader factory is registered, every request created from `BaseRequest` can read loading state:

```typescript
const request = new ExpenseIndexRequest()

request.send()

const isLoading = request.isLoading()
```

## Override Loader

You can override the loader per request with `setRequestLoader`:

```typescript
const request = new ExpenseIndexRequest()

request.setRequestLoader(customLoader)
```

This lets you create or share a loader before the request exists, which is useful when loading state must be wired up ahead of time.
