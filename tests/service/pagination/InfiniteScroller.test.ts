import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { InfiniteScroller } from '../../../src/pagination/InfiniteScroller'
import { ArrayDriver } from '../../../src/pagination/dataDrivers/ArrayDriver'
import { VuePaginationDriverFactory } from '../../../src/pagination/factories/VuePaginationDriverFactory'

describe('InfiniteScroller', () => {
  it('appends subsequent pages and exposes reactive initialization and totals', async () => {
    const paginator = new InfiniteScroller(new ArrayDriver([1, 2, 3]), 1, 2, { viewDriverFactory: new VuePaginationDriverFactory() })
    const initialized = computed(() => paginator.isInitialized())
    const rows = computed(() => paginator.getPageData())
    expect(initialized.value).toBe(false)
    await paginator.load()
    expect(initialized.value).toBe(true)
    expect(rows.value).toEqual([1, 2])
    await paginator.toNextPage()
    expect(rows.value).toEqual([1, 2, 3])
    expect(paginator.getCurrentPage()).toBe(2)
    expect(paginator.getTotal()).toBe(3)
  })

  it.each(['flush', 'replace'] as const)('reloads without retaining previously appended rows when %s is set', async (option) => {
    const driver = new ArrayDriver([1, 2, 3])
    const paginator = new InfiniteScroller(driver, 1, 2, { viewDriverFactory: new VuePaginationDriverFactory() })
    await paginator.load()
    await paginator.toNextPage()
    driver.setData([9, 10])
    await paginator.load(1, { [option]: true })
    expect(paginator.getPageData()).toEqual([9, 10])
    expect(paginator.getTotal()).toBe(2)
    expect(paginator.getCurrentPage()).toBe(1)
    expect(paginator.isInitialized()).toBe(true)
  })
})
