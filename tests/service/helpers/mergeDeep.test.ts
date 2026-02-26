import { mergeDeep } from '../../../src/support/helpers'
import { describe, it, expect } from 'vitest';

describe('mergeDeep', () => {
  it('should merge nested objects and replace primitive values', () => {
    const previous = {
      filter: {
        role: 'supplier',
        search_text: ''
      }
    }

    const params = {
      filter: {
        search_text: 'ad'
      }
    }

    const result = mergeDeep(previous, params)

    expect(result).toEqual({
      filter: {
        role: 'supplier',
        search_text: 'ad'
      }
    })
  })

  it('should deeply merge multiple levels', () => {
    const a = { a: { b: { c: 1 }, d: 2 } }
    const b = { a: { b: { c: 3 }, e: 4 } }

    const result = mergeDeep( a, b)

    expect(result).toEqual({
      a: {
        b: { c: 3 },
        d: 2,
        e: 4
      }
    })
  })

  it('should not mutate the original objects', () => {
    const a = { foo: { bar: 'baz' } }
    const b = { foo: { bar: 'qux' } }

    const result = mergeDeep({}, a, b)

    expect(result).toEqual({ foo: { bar: 'qux' } })
    expect(a.foo.bar).toBe('baz') // confirm a was not mutated
  })
})
