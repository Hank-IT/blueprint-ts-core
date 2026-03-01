import { describe, expect, it } from 'vitest'
import { VueBaseViewDriver } from '../../../src/pagination/frontendDrivers/VueBaseViewDriver'
import { VuePaginationDriver } from '../../../src/pagination/frontendDrivers/VuePaginationDriver'
import { VueBaseViewDriverFactory } from '../../../src/pagination/factories/VueBaseViewDriverFactory'



describe('Vue view drivers', () => {
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
