import { describe, expect, it } from 'vitest'
import { PropertyAwareArray } from '../../../src/vue/forms/PropertyAwareArray'

describe('PropertyAwareArray', () => {
  it('creates from array and preserves type on map/filter/slice/concat', () => {
    const arr = new PropertyAwareArray<number>([1, 2, 3])

    const mapped = arr.map((value) => value * 2)
    const filtered = arr.filter((value) => value > 1)
    const sliced = arr.slice(1)
    const concatenated = arr.concat([4])

    expect(mapped).toBeInstanceOf(PropertyAwareArray)
    expect(filtered).toBeInstanceOf(PropertyAwareArray)
    expect(sliced).toBeInstanceOf(PropertyAwareArray)
    expect(concatenated).toBeInstanceOf(PropertyAwareArray)

    expect(mapped).toEqual([2, 4, 6])
    expect(filtered).toEqual([2, 3])
    expect(sliced).toEqual([2, 3])
    expect(concatenated).toEqual([1, 2, 3, 4])
  })

  it('creates from arrayLike', () => {
    const from = PropertyAwareArray.from({ 0: 'a', 1: 'b', length: 2 })

    expect(from).toBeInstanceOf(PropertyAwareArray)
    expect(from).toEqual(['a', 'b'])
  })
})
