import { beforeEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { StatePaginator } from '../../../src/pagination/StatePaginator'
import { StatePaginationDataDto } from '../../../src/pagination/dtos/StatePaginationDataDto'
import { VueBaseViewDriverFactory } from '../../../src/pagination/factories/VueBaseViewDriverFactory'
import type { StatePaginationDataDriverContract } from '../../../src/pagination/contracts/StatePaginationDataDriverContract'

describe('StatePaginator', () => {
  beforeEach(() => StatePaginator.setViewDriverFactory(new VueBaseViewDriverFactory()))

  it('loads through the default view factory and forwards the returned cursor to the next load', async () => {
    const cursors: Array<string | null | undefined> = []
    const driver: StatePaginationDataDriverContract<number[]> = {
      get: async (cursor) => {
        cursors.push(cursor)
        return cursor === null ? new StatePaginationDataDto([1, 2], 3, 'next') : new StatePaginationDataDto([3], 3, null)
      }
    }
    const paginator = new StatePaginator(driver)
    const initialized = computed(() => paginator.isInitialized())
    const rows = computed(() => paginator.getPageData())
    expect(initialized.value).toBe(false)
    await paginator.load()
    expect(initialized.value).toBe(true)
    expect(rows.value).toEqual([1, 2])
    expect(paginator.getCurrentState()).toBe('next')
    expect(paginator.hasNextPage()).toBe(true)
    await paginator.loadNext()
    expect(cursors).toEqual([null, 'next'])
    expect(rows.value).toEqual([1, 2, 3])
    expect(paginator.getTotal()).toBe(3)
    expect(paginator.hasNextPage()).toBe(false)
  })

  it('restarts from the first cursor and replaces rows when the data source changes', async () => {
    const paginator = new StatePaginator(
      { get: async () => new StatePaginationDataDto([1], 2, 'old-next') },
      {
        viewDriverFactory: new VueBaseViewDriverFactory()
      }
    )
    await paginator.load()
    const cursors: Array<string | null | undefined> = []
    const replacement: StatePaginationDataDriverContract<number[]> = {
      get: async (cursor) => {
        cursors.push(cursor)
        return new StatePaginationDataDto([9], 1, null)
      }
    }
    expect(paginator.setDataDriver(replacement)).toBe(paginator)
    await paginator.load({ replace: true })
    expect(paginator.getDataDriver()).toBe(replacement)
    expect(cursors).toEqual([null])
    expect(paginator.getPageData()).toEqual([9])
    expect(paginator.getTotal()).toBe(1)
    expect(paginator.hasNextPage()).toBe(false)
  })

  it('preserves loaded rows and the cursor when loading the next page fails', async () => {
    const error = new Error('Page unavailable')
    const paginator = new StatePaginator({
      get: async (cursor: string | null) => {
        if (cursor !== null) throw error
        return new StatePaginationDataDto([1], 2, 'next')
      }
    })
    await paginator.load()
    await expect(paginator.loadNext()).rejects.toBe(error)
    expect(paginator.getPageData()).toEqual([1])
    expect(paginator.getCurrentState()).toBe('next')
    expect(paginator.getTotal()).toBe(2)
    expect(paginator.isInitialized()).toBe(true)
  })
})
