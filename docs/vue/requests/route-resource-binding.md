# Route Model Binding

When using `vue-router`, you can automatically bind route parameters to resources, similar to how Laravel's route model binding works.

## Setup

To enable the router to load resources automatically, install the route injection plugin when initializing your router:

```ts
installRouteInjection(router)
```

### Defining Routes

Use the `defineRoute` helper to define your routes and specify which parameters should be resolved into resources:

```ts
defineRoute<{
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
                    return new RouteModelRequestResolver(
                        new ProductShowRequest(productId)
                    )
                }
            }
        }
    }
})
```

The `beforeResolve` navigation guard will automatically fetch the `ProductResource` using the `ProductShowRequest` and the `productId` from the route.

## Usage in Components

Your component can then directly access the resolved resource via props:

```vue
<script setup lang="ts">
const props = defineProps<{
    product: ProductResource
}>()
</script>
```

## Handling Loading States

You can handle the loading state of the request by using the event system of the request class:

```ts
resolve: (productId: string) => {
    return new RouteModelRequestResolver(
        new ProductShowRequest(productId).on<boolean>(RequestEvents.LOADING, (loading: boolean) => {
          const loadingStore = useLoadingStore()
          loadingStore.setLoading(loading)
        })
    )
}
```