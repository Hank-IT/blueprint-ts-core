# DeferredPromise

`DeferredPromise` exposes a Promise along with `resolve`, `reject`, and a `state` property you can inspect.

```typescript
import { DeferredPromise } from '@blueprint-ts/core/support'

const deferred = new DeferredPromise<string>()

deferred.then((value) => {
    console.log(value)
})

deferred.resolve('Done')
```

State values:

- `pending`
- `fulfilled`
- `rejected`

## Example: Defer Component Rendering

Use a `DeferredPromise` to delay rendering of a Vue component until the slideover is opened and has received the props as non undefined:

```vue
<template>
  <SlideOver v-model="isOpen">
    <template v-if="resolvedresource">
      <UpdateForm :options="options" :resource="resolvedresource" />
    </template>
  </SlideOver>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { DeferredPromise } from '@blueprint-ts/core/support'

const props = defineProps<{ resource?: Resource }>()
const isOpen = defineModel<boolean>('isOpen', { default: false })

const readyPromise = new DeferredPromise<Resource>()
const resolvedresource = ref<Resource>(undefined)
let options: UpdateFormOptionsContract | undefined

readyPromise.then((contract) => {
  options = new UpdateFormOptions(contract)
})

onMounted(() => {
  readyPromise.then((resource: Resource) => {
      resolvedresource.value = resource
  })
})

watch(isOpen, (open) => {
  if (open && props.resource) {
    readyPromise.resolve(props.resource)
  }
})
</script>
```
