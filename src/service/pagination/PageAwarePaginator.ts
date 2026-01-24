import { PaginationDataDto } from './dtos/PaginationDataDto'
import { type ViewDriverContract } from './contracts/ViewDriverContract'
import { type ViewDriverFactoryContract } from './contracts/ViewDriverFactoryContract'
import { type PaginatorLoadDataOptions } from './contracts/PaginatorLoadDataOptions'
import { type PaginationDataDriverContract } from './contracts/PaginationDataDriverContract'
import { BasePaginator } from './BasePaginator'

export interface PageAwarePaginatorOptions {
  viewDriverFactory?: ViewDriverFactoryContract
}

export class PageAwarePaginator<ResourceInterface> extends BasePaginator<ResourceInterface, ViewDriverContract<ResourceInterface[]>> {
  protected static viewDriverFactory: ViewDriverFactoryContract

  protected override viewDriver: ViewDriverContract<ResourceInterface[]>

  public static setViewDriverFactory(value: ViewDriverFactoryContract): void {
    PageAwarePaginator.viewDriverFactory = value
  }

  public constructor(
    protected override dataDriver: PaginationDataDriverContract<ResourceInterface[]>,
    pageNumber: number = 1,
    pageSize: number = 10,
    options?: PageAwarePaginatorOptions
  ) {
    super(dataDriver)
    this.viewDriver = options?.viewDriverFactory
      ? options.viewDriverFactory.make<ResourceInterface>(pageNumber, pageSize)
      : PageAwarePaginator.viewDriverFactory.make<ResourceInterface>(pageNumber, pageSize)
  }

  public setDataDriver(dataDriver: PaginationDataDriverContract<ResourceInterface[]>): this {
    this.dataDriver = dataDriver

    return this
  }

  public getDataDriver(): PaginationDataDriverContract<ResourceInterface[]> {
    return this.dataDriver
  }

  public init(pageNumber: number, pageSize: number): Promise<PaginationDataDto<ResourceInterface[]>> {
    this.initialized = true

    if (pageNumber && pageSize) {
      return this.loadData(pageNumber, pageSize)
    }

    return this.loadData(this.getCurrentPage(), this.getPageSize())
  }

  public refresh(pageNumber?: number, options?: PaginatorLoadDataOptions): Promise<PaginationDataDto<ResourceInterface[]>> {
    if (pageNumber !== undefined) {
      return this.setPage(pageNumber, options)
    }

    return this.loadData(this.getCurrentPage(), this.getPageSize(), options)
  }

  public setPage(pageNumber: number, options?: PaginatorLoadDataOptions): Promise<PaginationDataDto<ResourceInterface[]>> {
    this.viewDriver.setPage(pageNumber)

    return this.loadData(this.viewDriver.getCurrentPage(), this.viewDriver.getPageSize(), options)
  }

  public getLastPage(): number {
    return this.viewDriver.getLastPage()
  }

  public toNextPage(): Promise<PaginationDataDto<ResourceInterface[]>> {
    return this.setPage(this.getCurrentPage() + 1)
  }

  public toFirstPage(): Promise<PaginationDataDto<ResourceInterface[]>> {
    return this.setPage(1)
  }

  public toLastPage(): Promise<PaginationDataDto<ResourceInterface[]>> {
    return this.setPage(this.viewDriver.getLastPage())
  }

  public toPreviousPage(): Promise<PaginationDataDto<ResourceInterface[]>> {
    return this.setPage(this.getCurrentPage() - 1)
  }

  public getCurrentPage(): number {
    return this.viewDriver.getCurrentPage()
  }

  public getFromItemNumber(): number {
    return (this.getCurrentPage() - 1) * this.getPageSize() + 1
  }

  public getToItemNumber(): number {
    return this.getCurrentPage() * this.getPageSize()
  }

  public getPageSize(): number {
    return this.viewDriver.getPageSize()
  }

  public setPageSize(pageSize: number): Promise<PaginationDataDto<ResourceInterface[]>> {
    this.viewDriver.setPageSize(pageSize)

    if (this.getCurrentPage() * pageSize > this.getTotal()) {
      return this.setPage(1)
    }

    return this.loadData(this.viewDriver.getCurrentPage(), this.viewDriver.getPageSize())
  }

  public getPages(): number[] {
    return this.viewDriver.getPages()
  }

  protected loadData(pageNumber: number, pageSize: number, options?: PaginatorLoadDataOptions): Promise<PaginationDataDto<ResourceInterface[]>> {
    return this.dataDriver.get(pageNumber, pageSize).then((value: PaginationDataDto<ResourceInterface[]>) => {
      this.passDataToViewDriver(value, options)

      return value
    })
  }
}
