# `useIsOpenFromVar`

`useIsOpenFromVar` ties a “selected value” to open/close state. When `fromVar` is set to a non-empty value, `isOpenFromVar` becomes `true`. When the modal closes, `fromVar` resets after a delay so exit animations can finish.

## Example

```ts
const { fromVar: selectedItem, isOpenFromVar: isDialogOpen, isOpenFromVarKey: dialogKey } =
  useIsOpenFromVar<Resource>()
```

Use it like this:

- set `selectedItem.value = item` to open the modal
- set `isDialogOpen.value = false` to close and reset `fromVar`

In the template:

```vue
<BulkEditDialog
  :key="dialogKey"
  v-model="isDialogOpen"
  :item="selectedItem"
/>
```

## Options

`useIsOpenFromVar` accepts two optional parameters:

- `defaultValue` (default `undefined`): value assigned to `fromVar` after close
- `delay` (default `500`): delay in milliseconds before resetting `fromVar` and bumping `isOpenFromVarKey`, so exit animations can finish
