import { computed } from 'vue'
import { ArrayDriver } from '../../../src/pagination/dataDrivers/ArrayDriver'
import { PageAwarePaginator } from '../../../src/pagination/PageAwarePaginator'
import { InfiniteScroller } from '../../../src/pagination/InfiniteScroller'
import { StatePaginator } from '../../../src/pagination/StatePaginator'
import { StatePaginationDataDto } from '../../../src/pagination/dtos/StatePaginationDataDto'
import { VuePaginationDriverFactory } from '../../../src/pagination/factories/VuePaginationDriverFactory'
import { describe, expect, it } from 'vitest'
import { VueBaseViewDriver } from '../../../src/pagination/frontendDrivers/VueBaseViewDriver'
import { VuePaginationDriver } from '../../../src/pagination/frontendDrivers/VuePaginationDriver'
import { VueBaseViewDriverFactory } from '../../../src/pagination/factories/VueBaseViewDriverFactory'

describe('Vue view drivers', () => {
  it.each(['page', 'infinite', 'state'] as const)('reactively exposes initialization after an empty %s load', async (kind) => {
    const paginator =
      kind === 'state'
        ? new StatePaginator<number>(
            { get: async () => new StatePaginationDataDto([], 0, null) },
            { viewDriverFactory: new VueBaseViewDriverFactory() }
          )
        : new (kind === 'page' ? PageAwarePaginator<number> : InfiniteScroller<number>)(new ArrayDriver<number>([]), 1, 10, {
            viewDriverFactory: new VuePaginationDriverFactory()
          })
    const ready = computed(() => paginator.isInitialized())
    expect(ready.value).toBe(false)
    await paginator.load()
    expect(ready.value).toBe(true)
    expect(paginator.getTotal()).toBe(0)
    expect(paginator.getPageData()).toEqual([])
  })

  it('VueBaseViewDriver stores data and total', () => {
    const driver = new VueBaseViewDriver<number>()

    driver.setData([1, 2])
    driver.setTotal(5)

    expect(driver.getData()).toEqual([1, 2])
    expect(driver.getTotal()).toBe(5)
  })

  it('VuePaginationDriver tracks pages', () => {
    const driver = new VuePaginationDriver<number>(2, 5)

    driver.setTotal(12)

    expect(driver.getCurrentPage()).toBe(2)
    expect(driver.getPageSize()).toBe(5)
    expect(driver.getLastPage()).toBe(3)
    expect(driver.getPages()).toEqual([1, 2, 3])

    driver.setPage(1)
    driver.setPageSize(4)
    driver.setTotal(9)

    expect(driver.getCurrentPage()).toBe(1)
    expect(driver.getPageSize()).toBe(4)
    expect(driver.getLastPage()).toBe(3)
  })

  it('VueBaseViewDriverFactory creates a driver', () => {
    const factory = new VueBaseViewDriverFactory()

    const driver = factory.make<number>()

    expect(driver.getData()).toEqual([])
    expect(driver.getTotal()).toBe(0)
  })
})
