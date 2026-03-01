import { describe, expect, it, vi } from 'vitest'
import useIsOpenFromVar from '../../../src/vue/composables/useIsOpenFromVar'

describe('useIsOpenFromVar', () => {
  it('syncs open state with variable and resets after delay', () => {
    vi.useFakeTimers()

    const { fromVar, isOpenFromVar, isOpenFromVarKey } = useIsOpenFromVar<string>('default', 50)

    fromVar.value = 'value'
    expect(isOpenFromVar.value).toBe(true)
    expect(fromVar.value).toBe('value')

    isOpenFromVar.value = false
    vi.advanceTimersByTime(50)

    expect(fromVar.value).toBe('default')
    expect(isOpenFromVarKey.value).toBe(1)

    vi.useRealTimers()
  })
})
