import { describe, expect, it } from 'vitest'
import { InfiniteScroller } from '../../../src/pagination/InfiniteScroller'
import { PaginationDataDto } from '../../../src/pagination/dtos/PaginationDataDto'
import type { PaginationDataDriverContract } from '../../../src/pagination/contracts/PaginationDataDriverContract'
import type { ViewDriverFactoryContract } from '../../../src/pagination/contracts/ViewDriverFactoryContract'
import type { ViewDriverContract } from '../../../src/pagination/contracts/ViewDriverContract'

class StubViewDriver implements ViewDriverContract<number[]> {
  private data: number[] = []
  private total = 0
  private currentPage: number
  private pageSize: number

  constructor(pageNumber: number, pageSize: number) {
    this.currentPage = pageNumber
    this.pageSize = pageSize
  }

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

  getCurrentPage(): number {
    return this.currentPage
  }

  setPage(value: number): void {
    this.currentPage = value
  }

  setPageSize(value: number): void {
    this.pageSize = value
  }

  getPageSize(): number {
    return this.pageSize
  }

  getLastPage(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize))
  }

  getPages(): number[] {
    return Array.from({ length: this.getLastPage() }, (_, i) => i + 1)
  }
}

class StubViewDriverFactory implements ViewDriverFactoryContract {
  public make<ResourceInterface>(pageNumber: number, pageSize: number): ViewDriverContract<ResourceInterface[]> {
    return new StubViewDriver(pageNumber, pageSize) as ViewDriverContract<ResourceInterface[]>
  }
}

describe('InfiniteScroller', () => {
  it('concatenates data by default', async () => {
    let call = 0
    const dataDriver: PaginationDataDriverContract<number[]> = {
      get: async () => {
        call += 1
        return new PaginationDataDto(call === 1 ? [1, 2] : [3], 3)
      },
    }

    const paginator = new InfiniteScroller<number[]>(dataDriver, 1, 2, {
      viewDriverFactory: new StubViewDriverFactory(),
    })

    await paginator.load()
    await paginator.load()

    expect(paginator.getPageData()).toEqual([1, 2, 3])
  })

  it('replaces data when replace is true', async () => {
    const dataDriver: PaginationDataDriverContract<number[]> = {
      get: async () => new PaginationDataDto([9], 1),
    }

    const paginator = new InfiniteScroller<number[]>(dataDriver, 1, 2, {
      viewDriverFactory: new StubViewDriverFactory(),
    })

    ;(paginator as any).viewDriver.setData([1, 2])

    await paginator.load(1, { replace: true })

    expect(paginator.getPageData()).toEqual([9])
  })
})
