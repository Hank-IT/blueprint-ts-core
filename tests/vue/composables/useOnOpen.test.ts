import { describe, expect, it, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import useOnOpen from '../../../src/vue/composables/useOnOpen'

describe('useOnOpen', () => {
  it('invokes open and close callbacks', async () => {
    const isOpen = ref(false)
    const { onOpen, onClose } = useOnOpen(isOpen)

    const openCb = vi.fn()
    const closeCb = vi.fn()

    onOpen(openCb)
    onClose(closeCb)

    isOpen.value = true
    await nextTick()
    await nextTick()
    expect(openCb).toHaveBeenCalledTimes(1)

    isOpen.value = false
    await nextTick()
    await nextTick()
    expect(closeCb).toHaveBeenCalledTimes(1)
  })
})
