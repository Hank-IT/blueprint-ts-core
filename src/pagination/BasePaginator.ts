import { PaginationDataDto } from './dtos/PaginationDataDto'
import { type BaseViewDriverContract } from './contracts/BaseViewDriverContract'
import { type PaginatorLoadDataOptions } from './contracts/PaginatorLoadDataOptions'

export abstract class BasePaginator<ResourceInterface, ViewDriver extends BaseViewDriverContract<ResourceInterface[]>> {
  protected initialized: boolean = false

  protected abstract viewDriver: ViewDriver

  public constructor(protected dataDriver: unknown) {}

  public isInitialized(): boolean {
    return this.initialized
  }

  public flush(): void {
    this.viewDriver.setData([])
  }

  public getPageData(): ResourceInterface[] {
    return this.viewDriver.getData()
  }

  public updateRows(
    predicate: (row: ResourceInterface, index: number, data: ResourceInterface[]) => boolean,
    updater: (row: ResourceInterface, index: number, data: ResourceInterface[]) => ResourceInterface | void
  ): number {
    const data = this.viewDriver.getData()
    let updated = 0

    for (let i = 0; i < data.length; i++) {
      const row = data[i]

      if (row === undefined) {
        continue
      }

      if (!predicate(row, i, data)) {
        continue
      }

      const result = updater(row, i, data)

      if (result !== undefined) {
        data[i] = result as ResourceInterface
      }

      updated++
    }

    if (updated > 0) {
      this.viewDriver.setData(data)
    }

    return updated
  }

  public getTotal(): number {
    return this.viewDriver.getTotal()
  }

  protected passDataToViewDriver(dto: PaginationDataDto<ResourceInterface[]>, options?: PaginatorLoadDataOptions): void {
    if (options?.flush) {
      this.flush()
    }

    this.viewDriver.setData(dto.getData())
    this.viewDriver.setTotal(dto.getTotal())
    this.initialized = true
  }

  protected handleStaleResponse(): PaginationDataDto<ResourceInterface[]> {
    return new PaginationDataDto<ResourceInterface[]>(this.viewDriver.getData(), this.viewDriver.getTotal())
  }
}
