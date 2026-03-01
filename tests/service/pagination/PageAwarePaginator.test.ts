import { describe, expect, it } from 'vitest'
import { PageAwarePaginator } from '../../../src/pagination/PageAwarePaginator'
import { PaginationDataDto } from '../../../src/pagination/dtos/PaginationDataDto'
import { StaleResponseException } from '../../../src/requests/exceptions/StaleResponseException'
import type { PaginationDataDriverContract } from '../../../src/pagination/contracts/PaginationDataDriverContract'
import type { ViewDriverContract } from '../../../src/pagination/contracts/ViewDriverContract'
import type { ViewDriverFactoryContract } from '../../../src/pagination/contracts/ViewDriverFactoryContract'

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

describe('PageAwarePaginator', () => {
  it('loads data and updates view driver', async () => {
    const dataDriver: PaginationDataDriverContract<number[]> = {
      get: async () => new PaginationDataDto([1, 2], 2),
    }

    const paginator = new PageAwarePaginator<number[]>(dataDriver, 1, 2, {
      viewDriverFactory: new StubViewDriverFactory(),
    })

    const dto = await paginator.load(2)

    expect(dto.getData()).toEqual([1, 2])
    expect(paginator.getCurrentPage()).toBe(2)
    expect(paginator.getPageData()).toEqual([1, 2])
    expect(paginator.getTotal()).toBe(2)
  })

  it('computes item range and pages', () => {
    const dataDriver: PaginationDataDriverContract<number[]> = {
      get: async () => new PaginationDataDto([1], 10),
    }

    const paginator = new PageAwarePaginator<number[]>(dataDriver, 2, 5, {
      viewDriverFactory: new StubViewDriverFactory(),
    })

    expect(paginator.getFromItemNumber()).toBe(6)
    expect(paginator.getToItemNumber()).toBe(10)
    paginator.getPageData()
  })

  it('resets page number when page size exceeds total', () => {
    const dataDriver: PaginationDataDriverContract<number[]> = {
      get: async () => new PaginationDataDto([1, 2], 3),
    }

    const paginator = new PageAwarePaginator<number[]>(dataDriver, 2, 2, {
      viewDriverFactory: new StubViewDriverFactory(),
    })

    ;(paginator as any).viewDriver.setTotal(3)
    paginator.setPageSize(2)

    expect(paginator.getCurrentPage()).toBe(1)
  })

  it('returns stale data when StaleResponseException occurs', async () => {
    const dataDriver: PaginationDataDriverContract<number[]> = {
      get: async () => {
        throw new StaleResponseException()
      },
    }

    const paginator = new PageAwarePaginator<number[]>(dataDriver, 1, 2, {
      viewDriverFactory: new StubViewDriverFactory(),
    })

    ;(paginator as any).viewDriver.setData([9])
    ;(paginator as any).viewDriver.setTotal(9)

    const dto = await paginator.load()

    expect(dto.getData()).toEqual([9])
    expect(dto.getTotal()).toBe(9)
  })
})
