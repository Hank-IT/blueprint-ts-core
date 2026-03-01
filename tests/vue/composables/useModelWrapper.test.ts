import { describe, expect, it, vi } from 'vitest'
import useModelWrapper from '../../../src/vue/composables/useModelWrapper'

describe('useModelWrapper', () => {
  it('wraps modelValue and emits updates', () => {
    const props = { modelValue: 1 }
    const emit = vi.fn()
    const callback = vi.fn()

    const model = useModelWrapper<number, typeof emit>(props, emit, { callback })

    expect(model.value).toBe(1)

    model.value = 2

    expect(emit).toHaveBeenCalledWith('update:modelValue', 2)
    expect(callback).toHaveBeenCalledWith(2)
  })

  it('supports custom model name', () => {
    const props = { custom: 'a' }
    const emit = vi.fn()

    const model = useModelWrapper<string, typeof emit>(props, emit, { name: 'custom' })

    model.value = 'b'

    expect(emit).toHaveBeenCalledWith('update:custom', 'b')
  })
})
