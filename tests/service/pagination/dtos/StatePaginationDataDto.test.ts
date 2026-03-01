import { describe, expect, it } from 'vitest'
import { StatePaginationDataDto } from '../../../../src/pagination/dtos/StatePaginationDataDto'

describe('StatePaginationDataDto', () => {
  it('returns state and next page status', () => {
    const dto = new StatePaginationDataDto([1], 1, 'next')

    expect(dto.getState()).toBe('next')
    expect(dto.hasNextPage()).toBe(true)

    const end = new StatePaginationDataDto([1], 1, null)
    expect(end.hasNextPage()).toBe(false)
  })
})
