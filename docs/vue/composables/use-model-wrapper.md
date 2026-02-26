# `useModelWrapper`

`useModelWrapper` is a small helper to implement `v-model` in components. It returns a computed ref that proxies the model value and emits the update event.

Deprecated: In Vue 3.4+, prefer `defineModel()` where possible. `useModelWrapper` remains available for legacy usage or when you need a callback on update.

## Example

```vue
<script setup lang="ts">
import { useModelWrapper } from '@blueprint-ts/core/vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: boolean): void }>()

const model = useModelWrapper<boolean, typeof emit>(props, emit)
</script>
```

Using a custom model name:

```ts
const model = useModelWrapper<boolean, typeof emit>(props, emit, { name: 'open' })
```

## Options

- `name` (default `modelValue`): the model prop/event name
- `callback` (optional): invoked with the new value after emitting the update event
