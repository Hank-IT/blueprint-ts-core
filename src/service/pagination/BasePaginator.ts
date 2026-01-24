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

  public getTotal(): number {
    return this.viewDriver.getTotal()
  }

  protected passDataToViewDriver(dto: PaginationDataDto<ResourceInterface[]>, options?: PaginatorLoadDataOptions): void {
    if (options?.flush) {
      this.flush()
    }

    this.viewDriver.setData(dto.getData())
    this.viewDriver.setTotal(dto.getTotal())
  }
}
