import { describe, expect, it } from 'vitest'
import { BasePaginator } from '../../../src/pagination/BasePaginator'
import { PaginationDataDto } from '../../../src/pagination/dtos/PaginationDataDto'
import type { BaseViewDriverContract } from '../../../src/pagination/contracts/BaseViewDriverContract'

class TestViewDriver implements BaseViewDriverContract<number[]> {
  private data: number[] = []
  private total = 0

  setData(data: number[]): void {
    this.data = data
  }

  getData(): number[] {
    return this.data
  }

  setTotal(value: number): void {
    this.total = value
  }

  getTotal(): number {
    return this.total
  }
}

class TestPaginator extends BasePaginator<number, TestViewDriver> {
  protected override viewDriver = new TestViewDriver()

  public exposePass(dto: PaginationDataDto<number[]>, options?: { flush?: boolean }) {
    this.passDataToViewDriver(dto, options)
  }

  public exposeHandleStale() {
    return this.handleStaleResponse()
  }

  public getViewDriver() {
    return this.viewDriver
  }
}

describe('BasePaginator', () => {
  it('updates rows and returns updated count', () => {
    const paginator = new TestPaginator(null)
    paginator.getViewDriver().setData([1, 2, 3])

    const updated = paginator.updateRows(
      (row) => row % 2 === 0,
      (row) => row * 10
    )

    expect(updated).toBe(1)
    expect(paginator.getPageData()).toEqual([1, 20, 3])
  })

  it('removes rows and adjusts total', () => {
    const paginator = new TestPaginator(null)
    paginator.getViewDriver().setData([1, 2, 3])
    paginator.getViewDriver().setTotal(3)

    const removed = paginator.removeRows((row) => row > 1)

    expect(removed).toBe(2)
    expect(paginator.getPageData()).toEqual([1])
    expect(paginator.getTotal()).toBe(1)
  })

  it('can remove rows without adjusting total', () => {
    const paginator = new TestPaginator(null)
    paginator.getViewDriver().setData([1, 2, 3])
    paginator.getViewDriver().setTotal(3)

    paginator.removeRows((row) => row === 1, { adjustTotal: false })

    expect(paginator.getPageData()).toEqual([2, 3])
    expect(paginator.getTotal()).toBe(3)
  })

  it('passes data to view driver and marks initialized', () => {
    const paginator = new TestPaginator(null)

    paginator.exposePass(new PaginationDataDto([4, 5], 2), { flush: true })

    expect(paginator.getPageData()).toEqual([4, 5])
    expect(paginator.getTotal()).toBe(2)
    expect(paginator.isInitialized()).toBe(true)
  })

  it('handles stale response by returning current data/total', () => {
    const paginator = new TestPaginator(null)
    paginator.getViewDriver().setData([7])
    paginator.getViewDriver().setTotal(9)

    const dto = paginator.exposeHandleStale()

    expect(dto.getData()).toEqual([7])
    expect(dto.getTotal()).toBe(9)
  })
})
