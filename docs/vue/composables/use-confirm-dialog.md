# `useConfirmDialog`

`useConfirmDialog` mounts a confirmation dialog component on demand and returns an `openConfirmDialog` function that resolves to `true` or `false`.

## Requirements

- Call `useConfirmDialog` inside a `setup()` function.
- The dialog component must expose an `open()` method via `defineExpose`.
- `open()` must return a `Promise<boolean>`.
- The component receives an `options` prop that matches `ConfirmDialogOptions`.

## Example

```vue
<template>
  <button @click.prevent="click">
    <slot />
  </button>
</template>

<script setup lang="ts">
import { useConfirmDialog, type ConfirmDialogOptions } from '@blueprint-ts/core/vue'
import ConfirmDialog from '@/ConfirmDialog.vue'

const props = defineProps<{
  confirmation?: ConfirmDialogOptions
}>()

const { openConfirmDialog } = useConfirmDialog(ConfirmDialog)

async function click() {
  if (props.confirmation) {
    const confirmed = await openConfirmDialog(props.confirmation)

    if (confirmed) {
        const request = new Request()
        
        request.send()
    }
  }
}
</script>
```

## ConfirmDialogOptions

The options object must implement the following contract:

```ts
import { ConfirmDialogSeverity } from '@blueprint-ts/core/vue'

export interface ConfirmDialogOptions {
  getMessage(): string
  getSeverity(): ConfirmDialogSeverity
  getTitle(): string
  getOkText(): string
  getCancelText(): string
}
```

The available severities are:

```ts
export enum ConfirmDialogSeverity {
  INFO = 'info',
  WARNING = 'warning',
  DANGER = 'danger'
}
```

## Dialog Component Contract

The dialog component must expose `open()` using `defineExpose`:

```vue
<script setup lang="ts">
import { type ConfirmDialogOptions } from '@blueprint-ts/core/vue'

const props = defineProps<{ options: ConfirmDialogOptions }>()

async function open(): Promise<boolean> {
  // open dialog and resolve with true or false
  return true
}

defineExpose({ open })
</script>
```

## Mount Target

`useConfirmDialog` accepts an optional second parameter to control where the dialog is mounted:

```ts
const { openConfirmDialog } = useConfirmDialog(ConfirmDialog, '#dialog-root')
```
