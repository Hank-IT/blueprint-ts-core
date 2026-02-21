## Upgrading from v1 to v2

### Route Resource Binding

Commit `db70b77` introduced significant changes to the route resource binding system to support better caching, parent-to-child inheritance, and non-blocking navigation.

#### Non-blocking Navigation (Breaking Change)

In v1, navigation was blocked until all resources were resolved in the `beforeResolve` guard. In v2, navigation proceeds immediately, and resources are loaded in the background.

This means that your components will now render **before** the resources are available (they will be `undefined` initially).

**How to upgrade:**

1.  **Use `RouteResourceBoundView`**: Replace `<RouterView>` with `<RouteResourceBoundView>`. This component automatically manages loading and error states for you.
    ```vue
    <script setup lang="ts">
    import { RouteResourceBoundView } from '@blueprint-ts/core'
    </script>

    <template>
      <RouteResourceBoundView />
    </template>
    ```

2.  **Define Loading/Error Components**: You can now define these directly in your `defineRoute` call to be used by `RouteResourceBoundView`:
    ```ts
    defineRoute<{ product: ProductResource }>()({
        path: ':productId',
        component: ProductDetailPage,
        loadingComponent: MyLoadingSpinner,
        errorComponent: MyErrorPage,
        inject: {
            product: { from: 'productId', resolve: ... }
        }
    })
    ```

3.  **Manual Handling**: If you want your component to handle its own loading state, set `lazy: false` in the route definition and use the updated `useRouteResource` composable.

#### `useRouteResource` API Changes (Breaking Change)

The `useRouteResource` composable has been updated to support multiple resources and provide reactive state.

*   **v1**: `const { refresh } = useRouteResource()`
*   **v2**: `const { refresh, isLoading, error } = useRouteResource('resourceName')`

The `refresh` function no longer takes the resource name as an argument. It now accepts an optional options object for silent refreshes.

```ts
// v1
const { refresh } = useRouteResource()
await refresh('product')

// v2
const { refresh, isLoading, error } = useRouteResource('product')
await refresh() // Triggers loading state
await refresh({ silent: true }) // Background refresh
```

#### New Features: Caching and Inheritance

*   **Caching**: Resources are now cached based on the route parameter value. Navigating between child routes that share the same parameter will no longer trigger redundant requests.
*   **Inheritance**: Child routes now automatically inherit resources defined on parent routes. You can define a resource once on a parent route and it will be available to all children through props or `useRouteResource`.