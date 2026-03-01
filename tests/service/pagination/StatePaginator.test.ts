import { describe, expect, it } from 'vitest'
import { StatePaginator } from '../../../src/pagination/StatePaginator'
import { StatePaginationDataDto } from '../../../src/pagination/dtos/StatePaginationDataDto'
import type { BaseViewDriverContract } from '../../../src/pagination/contracts/BaseViewDriverContract'
import type { BaseViewDriverFactoryContract } from '../../../src/pagination/contracts/BaseViewDriverFactoryContract'
import type { StatePaginationDataDriverContract } from '../../../src/pagination/contracts/StatePaginationDataDriverContract'

class StubViewDriver implements BaseViewDriverContract<number[]> {
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

class StubViewDriverFactory implements BaseViewDriverFactoryContract {
  public make<ResourceInterface>(): BaseViewDriverContract<ResourceInterface[]> {
    return new StubViewDriver() as BaseViewDriverContract<ResourceInterface[]>
  }
}

describe('StatePaginator', () => {
  it('loads and appends data, tracking state', async () => {
    const dataDriver: StatePaginationDataDriverContract<number[]> = {
      get: async () => new StatePaginationDataDto([1, 2], 2, 'next'),
    }

    const paginator = new StatePaginator<number[]>(dataDriver, {
      viewDriverFactory: new StubViewDriverFactory(),
    })

    const dto = await paginator.load()

    expect(dto.getData()).toEqual([1, 2])
    expect(paginator.getPageData()).toEqual([1, 2])
    expect(paginator.getTotal()).toBe(2)
    expect(paginator.getCurrentState()).toBe('next')
    expect(paginator.hasNextPage()).toBe(true)
  })

  it('supports loadNext and replace option', async () => {
    let call = 0
    const dataDriver: StatePaginationDataDriverContract<number[]> = {
      get: async (state) => {
        call += 1
        return new StatePaginationDataDto(call === 1 ? [1] : [2], 2, state ? null : 'next')
      },
    }

    const paginator = new StatePaginator<number[]>(dataDriver, {
      viewDriverFactory: new StubViewDriverFactory(),
    })

    await paginator.load()
    await paginator.loadNext()

    expect(paginator.getPageData()).toEqual([1, 2])
    expect(paginator.hasNextPage()).toBe(false)

    ;(paginator as any).passStateDataToViewDriver(new StatePaginationDataDto([9], 1, null), { replace: true })
    expect(paginator.getPageData()).toEqual([9])
  })
})
