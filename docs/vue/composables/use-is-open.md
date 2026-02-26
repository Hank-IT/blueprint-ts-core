# `useIsOpen`

`useIsOpen` manages a boolean open state and an `isOpenKey` that increments whenever the state is closed. This is useful for forcing re-mounts after a close animation.

## Example

```ts
import { useIsOpen } from '@blueprint-ts/core/vue'

const { isOpen, isOpenKey } = useIsOpen((value) => {
  if (!value) {
    // closed
  }
})
```

In a template, bind `isOpenKey` to force a re-mount when closing:

```vue
<Modal :key="isOpenKey" v-model="isOpen" />
```

## Options

`useIsOpen` accepts two optional parameters:

- `callback` (default `() => {}`): called whenever `isOpen` changes
- `delay` (default `500`): delay in milliseconds before incrementing `isOpenKey` on close so exit animations can finish
