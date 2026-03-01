import { describe, expect, it } from 'vitest'
import useIsEmpty from '../../../src/vue/composables/useIsEmpty'

describe('useIsEmpty', () => {
  it('detects empty values', () => {
    const { isEmpty, isNotEmpty } = useIsEmpty()

    expect(isEmpty(undefined)).toBe(true)
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty('')).toBe(true)
    expect(isEmpty([])).toBe(true)
    expect(isEmpty({})).toBe(true)

    expect(isNotEmpty('a')).toBe(true)
    expect(isNotEmpty([1])).toBe(true)
    expect(isNotEmpty({ a: 1 })).toBe(true)
  })
})
