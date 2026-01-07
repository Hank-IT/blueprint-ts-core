import { getCurrentInstance, shallowRef, computed, type Component, type Ref, type ComputedRef, h, render, onUnmounted } from 'vue'

interface UseGlobalCheckboxOptions<T> {
  getAll: () => Promise<T[]>
  getPage: () => T[]
  totalCount: () => number
}

export default function <T>(
  dialog: Component,
  options: UseGlobalCheckboxOptions<T>,
  querySelector: string = 'body'
): {
  selectedRows: Ref<T[]>
  indeterminate: ComputedRef<boolean>
  checked: ComputedRef<boolean>
  handleGlobalCheckboxChange: (event: Event) => void
} {
  const self = getCurrentInstance()
  const selectedRows = shallowRef<T[]>([])

  function mountDialog() {
    if (!self?.appContext) {
      throw new Error('useGlobalCheckbox must be called inside a setup function')
    }

    const vNode = h(dialog, {
      indeterminate: indeterminate.value,
      checked: checked.value
    })
    vNode.key = Symbol()
    vNode.appContext = self.appContext
    render(vNode, document.querySelector(querySelector) as Element)
    return vNode.component
  }

  function unmountConfirmDialog() {
    render(null, document.querySelector(querySelector) as Element)
  }

  onUnmounted(() => {
    unmountConfirmDialog()
  })

  const indeterminate = computed(() => {
    const totalCount: number = options.totalCount()
    return selectedRows.value.length > 0 && selectedRows.value.length < totalCount
  })

  const checked = computed({
    get: () => {
      const totalCount: number = options.totalCount()

      return selectedRows.value.length > 0 && selectedRows.value.length === totalCount
    },
    set: (value: boolean) => {
      if (!value) {
        selectedRows.value = []
      }
    }
  })

  // Check if all elements are already displayed on the current page
  const isAllElementsOnCurrentPage = (): boolean => {
    return options.getPage().length === options.totalCount()
  }

  async function handleGlobalCheckboxChange(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) {
      return
    }

    const pageData: T[] = options.getPage()

    // If all elements are on the current page, we can skip the dialog
    // as both options would result in the same selection
    const allElementsOnPage = isAllElementsOnCurrentPage()

    // Case 1: Nothing is selected (unchecked state)
    if (!checked.value && !indeterminate.value) {
      if (allElementsOnPage) {
        // All elements are already on the current page, just select them
        selectedRows.value = [...pageData]
        return
      }

      // We need preventDefault() here because we're showing a dialog
      // and don't want the checkbox to be checked until the user makes a choice
      event.preventDefault()

      const mountedDialog = mountDialog()
      if (!mountedDialog?.exposed) return

      // When clicking the empty checkbox, ask if user wants current page or all entries
      if (await mountedDialog.exposed['open']) {
        // User clicked "All Elements" button
        selectedRows.value = await options.getAll()
      } else {
        // User clicked "Current Page" button
        selectedRows.value = [...pageData]
      }
      return
    }

    // Case 2: Indeterminate state (some items selected, not all)
    if (indeterminate.value) {
      if (allElementsOnPage) {
        // If all elements are on the page, just select them all
        selectedRows.value = [...pageData]
        return
      }

      // We need preventDefault() here because we're showing a dialog
      // and don't want the checkbox to be checked until the user makes a choice
      event.preventDefault()

      const mountedDialog = mountDialog()
      if (!mountedDialog?.exposed) return

      // When clicking the indeterminate checkbox, ask if the user wants all entries or unselect all
      if (await mountedDialog.exposed['open']) {
        // User clicked "All Elements" button
        selectedRows.value = await options.getAll()
      } else {
        // User clicked "Discard" button
        selectedRows.value = []
      }
      return
    }

    // Case 3: Checked state (all items selected)
    if (checked.value) {
      // When all items are selected, we just clear the selection without a dialog
      selectedRows.value = []
      return
    }
  }

  return {
    selectedRows,
    indeterminate,
    checked,
    handleGlobalCheckboxChange
  }
}
