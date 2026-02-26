# `useGlobalCheckbox`

`useGlobalCheckbox` helps you implement “select all” behavior across a paginated data set. It manages:

- selected rows
- indeterminate/checked state
- a dialog to choose between selecting the current page or all rows

## Requirements

- Call `useGlobalCheckbox` inside a `setup()` function.
- Provide a dialog component that exposes an `open()` method via `defineExpose`.
- `open()` must return a `Promise<boolean>`.
- The dialog receives `checked` and `indeterminate` props.

## Example

```ts
const { selectedRows, indeterminate, checked, handleGlobalCheckboxChange } =
  useGlobalCheckbox<CredentialListResource>(BulkSelectDialog, {
    getAll: async () => {
      isLoadingAllElements.value = true

      try {
        const response = await request.withParams(buildParams()).send()
        return response.getData()
      } catch (error) {
        console.error(error)
        return []
      } finally {
        isLoadingAllElements.value = false
      }
    },
    getPage: () => paginator.getPageData(),
    totalCount: () => paginator.getTotal()
  })
```

In the template, bind the handler to your global checkbox:

```vue
<input
  type="checkbox"
  :checked="checked"
  :indeterminate="indeterminate"
  @change="handleGlobalCheckboxChange"
/>
```

## Dialog Component Contract

Your dialog component should accept `checked` and `indeterminate` props and expose `open()`:

```vue
<script setup lang="ts">
const props = defineProps<{ checked: boolean; indeterminate: boolean }>()

async function open(): Promise<boolean> {
  // true = select all entries, false = select current page / discard
  return true
}

defineExpose({ open })
</script>
```

## Mount Target

You can pass a third argument to control where the dialog is mounted:

```ts
const { handleGlobalCheckboxChange } = useGlobalCheckbox(BulkSelectDialog, options, '#dialog-root')
```
