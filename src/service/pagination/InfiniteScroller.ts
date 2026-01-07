import { Paginator } from './Paginator'
import { PaginationDataDto } from './dtos/PaginationDataDto'
import { type PaginatorLoadDataOptions } from './contracts/PaginatorLoadDataOptions'

export class InfiniteScroller<ResourceInterface> extends Paginator<ResourceInterface> {
  protected override passDataToViewDriver(dto: PaginationDataDto<ResourceInterface[]>, options: PaginatorLoadDataOptions = {}) {
    const { flush = false, replace = false } = options

    if (flush) {
      this.flush()
    }

    if (replace) {
      this.viewDriver.setData(dto.getData())
    } else {
      this.viewDriver.setData(this.viewDriver.getData().concat(dto.getData()))
    }

    this.viewDriver.setTotal(dto.getTotal())
  }
}
