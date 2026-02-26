# `useOnOpen`

`useOnOpen` lets you register callbacks that run when a boolean ref toggles from closed to open or vice versa.

## Example

```ts
import { useOnOpen } from '@blueprint-ts/core/vue'
import { ref } from 'vue'

const isOpen = ref(false)
const { onOpen, onClose } = useOnOpen(isOpen)

onOpen(() => {
  // opened
})

onClose(() => {
  // closed
})
```

## Notes

Callbacks are executed on the next tick after the value changes.
You can register multiple callbacks for both `onOpen` and `onClose`.
