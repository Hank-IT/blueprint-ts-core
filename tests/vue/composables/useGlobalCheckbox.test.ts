import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, type Component } from 'vue'
import useGlobalCheckbox from '../../../src/vue/composables/useGlobalCheckbox'

const setupComposable = <T>(dialog: Component, options: { getAll: () => Promise<T[]>; getPage: () => T[]; totalCount: () => number }, targetId: string) => {
  const dialogTarget = document.createElement('div')
  dialogTarget.id = targetId
  document.body.appendChild(dialogTarget)

  let api: ReturnType<typeof useGlobalCheckbox<T>> | undefined

  const App = defineComponent({
    setup() {
      api = useGlobalCheckbox<T>(dialog, options, `#${targetId}`)
      return () => h('div')
    },
  })

  const root = document.createElement('div')
  document.body.appendChild(root)
  createApp(App).mount(root)

  return api!
}

const createEvent = () => {
  const input = document.createElement('input')
  const event = new Event('change') as Event & { target: HTMLInputElement; preventDefault: () => void }
  Object.defineProperty(event, 'target', { value: input })
  event.preventDefault = vi.fn()
  return event
}

describe('useGlobalCheckbox', () => {
  it('selects current page when all elements are on page', async () => {
    const Dialog = defineComponent({
      setup(_, { expose }) {
        expose({ open: Promise.resolve(true) })
        return () => h('div')
      },
    })

    const options = {
      getAll: vi.fn().mockResolvedValue([1, 2]),
      getPage: vi.fn().mockReturnValue([1, 2]),
      totalCount: vi.fn().mockReturnValue(2),
    }

    const api = setupComposable<number>(Dialog, options, 'dialog-all')

    await api.handleGlobalCheckboxChange(createEvent())

    expect(api.selectedRows.value).toEqual([1, 2])
  })

  it('opens dialog to select all when not all elements are on page', async () => {
    const Dialog = defineComponent({
      setup(_, { expose }) {
        expose({ open: Promise.resolve(true) })
        return () => h('div')
      },
    })

    const options = {
      getAll: vi.fn().mockResolvedValue([1, 2, 3]),
      getPage: vi.fn().mockReturnValue([1]),
      totalCount: vi.fn().mockReturnValue(3),
    }

    const api = setupComposable<number>(Dialog, options, 'dialog-select-all')
    const event = createEvent()

    await api.handleGlobalCheckboxChange(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(api.selectedRows.value).toEqual([1, 2, 3])
  })

  it('clears selection on indeterminate cancel', async () => {
    const Dialog = defineComponent({
      setup(_, { expose }) {
        expose({ open: Promise.resolve(false) })
        return () => h('div')
      },
    })

    const options = {
      getAll: vi.fn().mockResolvedValue([1, 2, 3]),
      getPage: vi.fn().mockReturnValue([1]),
      totalCount: vi.fn().mockReturnValue(3),
    }

    const api = setupComposable<number>(Dialog, options, 'dialog-cancel')
    api.selectedRows.value = [1]

    await api.handleGlobalCheckboxChange(createEvent())

    expect(api.selectedRows.value).toEqual([])
  })

  it('clears selection when already checked', async () => {
    const Dialog = defineComponent({
      setup(_, { expose }) {
        expose({ open: Promise.resolve(true) })
        return () => h('div')
      },
    })

    const options = {
      getAll: vi.fn().mockResolvedValue([1, 2]),
      getPage: vi.fn().mockReturnValue([1, 2]),
      totalCount: vi.fn().mockReturnValue(2),
    }

    const api = setupComposable<number>(Dialog, options, 'dialog-checked')
    api.selectedRows.value = [1, 2]

    await api.handleGlobalCheckboxChange(createEvent())

    expect(api.selectedRows.value).toEqual([])

    api.selectedRows.value = [1]
    api.checked.value = false
    expect(api.selectedRows.value).toEqual([])
  })
})
