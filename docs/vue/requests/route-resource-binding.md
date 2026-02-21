# Route Resource Binding

When using `vue-router`, you can automatically bind route parameters to resources, similar to how Laravel's route model binding works.

## Setup

To enable the router to load resources automatically, install the route injection plugin when initializing your router:

```ts
import { installRouteInjection } from '@blueprint-ts/core'

installRouteInjection(router)
```

## Defining Routes

Use the `defineRoute` helper to define your routes and specify which parameters should be resolved into resources:

```ts
import { defineRoute, RouteResourceRequestResolver } from '@blueprint-ts/core'
import ProductDetailPage from '@/pages/ProductDetailPage.vue'

export default defineRoute<{
    product: ProductResource
}>()({
    path: ':productId',
    name: 'products.show',
    component: ProductDetailPage,
    meta: {
        inject: {
            product: {
                from: 'productId',
                resolve: (productId: string) => {
                    return new RouteResourceRequestResolver(
                            new ProductShowRequest(productId)
                    )
                }
            }
        }
    }
})
```

Navigation is blocking by default. Cached values are reused when navigating between child routes with unchanged parameters.

## Usage in Components

Your component can directly access the resolved resource via props:

```vue
<script setup lang="ts">
const props = defineProps<{
    product: ProductResource
}>()
</script>
```

## Handling Loading & Error States

### Using `RouteResourceBoundView`

`RouteResourceBoundView` is a drop-in replacement for `<RouterView>` that automatically handles loading and error states. Define error and loading components directly in the route:

```ts
import { defineRoute, RouteResourceRequestResolver } from '@blueprint-ts/core'
import ProductDetailPage from '@/pages/ProductDetailPage.vue'
import GenericErrorPage from '@/pages/GenericErrorPage.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

export default defineRoute<{
    product: ProductResource
}>()({
    path: ':productId',
    name: 'products.show',
    component: ProductDetailPage,
    errorComponent: GenericErrorPage,
    loadingComponent: LoadingSpinner,
    meta: {
        inject: {
            product: {
                from: 'productId',
                resolve: (productId: string) => {
                    return new RouteResourceRequestResolver(
                            new ProductShowRequest(productId)
                    )
                }
            }
        }
    }
})
```

Then replace `<RouterView>` with `<RouteResourceBoundView>` in your layout:

```vue
<template>
  <RouteResourceBoundView />
</template>

<script setup lang="ts">
import { RouteResourceBoundView } from '@blueprint-ts/core'
</script>
```

The `errorComponent` receives `error` and `refresh` as props. The `refresh` function retries all failed resources:

```vue
<!-- GenericErrorPage.vue -->
<template>
  <div>
    <p>{{ error.message }}</p>
    <button @click="refresh">Try Again</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
    error: Error
    refresh: () => Promise<void>
}>()
</script>
```

#### Using Scoped Slots

`RouteResourceBoundView` supports the same `v-slot` pattern as `<RouterView>`:

```vue
<RouteResourceBoundView v-slot="{ Component, route }">
  <component
    :is="Component"
    v-if="Component"
  />
  <EmptyState v-else />
</RouteResourceBoundView>
```

When no `errorComponent` or `loadingComponent` is defined on the route, you can use named slots as fallbacks:

```vue
<RouteResourceBoundView>
  <template #default="{ Component, route }">
    <component :is="Component" v-if="Component" />
  </template>

  <template #loading>
    <LoadingSpinner />
  </template>

  <template #error="{ error, refresh }">
    <div>
      <p>{{ error.message }}</p>
      <button @click="refresh">Retry</button>
    </div>
  </template>
</RouteResourceBoundView>
```

### Using `useRouteResource` (Manual Handling)

If you prefer to handle loading and error states inside the component itself, set `lazy: false` on the route. This renders the component immediately while resources resolve in the background:

```ts
export default defineRoute<{
    product: ProductResource
}>()({
    path: ':productId',
    name: 'products.show',
    component: ProductDetailPage,
    lazy: false,
    meta: {
        inject: {
            product: {
                from: 'productId',
                resolve: (productId: string) => {
                    return new RouteResourceRequestResolver(
                            new ProductShowRequest(productId)
                    )
                }
            }
        }
    }
})
```

Then use the `useRouteResource` composable inside your component:

```vue
<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="error">
    <p>{{ error.message }}</p>
    <button @click="refresh">Retry</button>
  </div>
  <div v-else>
    <h1>{{ product.name }}</h1>
  </div>
</template>

<script setup lang="ts">
import { useRouteResource } from '@blueprint-ts/core'

const props = defineProps<{
    product: ProductResource
}>()

const { refresh, isLoading, error } = useRouteResource('product')
</script>
```

`useRouteResource` returns:

| Property    | Type                      | Description                              |
|-------------|---------------------------|------------------------------------------|
| `isLoading` | `ComputedRef<boolean>`    | `true` while the resource is resolving   |
| `error`     | `ComputedRef<Error\|null>` | The error if resolution failed, else `null` |
| `refresh`   | `(options?: { silent?: boolean }) => Promise<void>` | Re-fetches the resource. Pass `{ silent: true }` to suppress the loading state. |

#### Silent Refresh

By default, calling `refresh()` sets `isLoading` to `true` while the resource is being re-fetched, which causes `RouteResourceBoundView` to show the loading component. If you want to refresh the resource in the background without triggering the loading state (e.g. polling or optimistic updates), pass `{ silent: true }`:

```ts
const { refresh } = useRouteResource('product')

// Normal refresh — triggers loading state
await refresh()

// Silent refresh — does not trigger loading state
await refresh({ silent: true })
```

A silent refresh still updates the `error` state if the request fails.

### Lazy vs Non-Lazy

| Option          | Behavior                                                                                      |
|-----------------|-----------------------------------------------------------------------------------------------|
| `lazy: true` (default) | `RouteResourceBoundView` intercepts loading/error states and shows the appropriate component |
| `lazy: false`   | The target component renders immediately; use `useRouteResource()` for manual state handling  |
