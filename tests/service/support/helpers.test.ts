import { beforeEach, describe, expect, it } from 'vitest'
import { getCookie, getDisplayablePages, isAtBottom, isObject } from '../../../src/support/helpers'

describe('support helpers', () => {
  beforeEach(() => {
    document.cookie = ''
  })

  it('reads cookies by name and trims spaces', () => {
    document.cookie = 'first=one'
    document.cookie = 'second=two'

    expect(getCookie('first')).toBe('one')
    expect(getCookie('second')).toBe('two')
    expect(getCookie('missing')).toBe('')
  })

  it('detects objects and excludes arrays/null', () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject(undefined)).toBe(false)
  })

  it('calculates displayable pages with bounds', () => {
    expect(getDisplayablePages(3, 1, 4)).toEqual([1, 2, 3])
    expect(getDisplayablePages(10, 1, 4)).toEqual([1, 2, 3, 4])
    expect(getDisplayablePages(10, 5, 4)).toEqual([4, 5, 6, 7])
    expect(getDisplayablePages(10, 10, 4)).toEqual([7, 8, 9, 10])
  })

  it('detects near-bottom scroll positions', () => {
    expect(isAtBottom(100, 97, 3)).toBe(true)
    expect(isAtBottom(100, 90, 3)).toBe(false)
  })
})
