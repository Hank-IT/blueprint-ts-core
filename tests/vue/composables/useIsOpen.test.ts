import { describe, expect, it, vi } from 'vitest'
import useIsOpen from '../../../src/vue/composables/useIsOpen'

describe('useIsOpen', () => {
  it('tracks open state and increments key after delay', () => {
    vi.useFakeTimers()

    const callback = vi.fn()
    const { isOpen, isOpenKey } = useIsOpen(callback, 50)

    isOpen.value = true
    expect(isOpen.value).toBe(true)
    expect(callback).toHaveBeenCalledWith(true)

    isOpen.value = false
    expect(isOpen.value).toBe(false)
    expect(callback).toHaveBeenCalledWith(false)

    expect(isOpenKey.value).toBe(0)
    vi.advanceTimersByTime(50)
    expect(isOpenKey.value).toBe(1)

    vi.useRealTimers()
  })
})
