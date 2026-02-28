import { PaginationDataDto } from './dtos/PaginationDataDto'
import { type ViewDriverContract } from './contracts/ViewDriverContract'
import { type ViewDriverFactoryContract } from './contracts/ViewDriverFactoryContract'
import { type PaginatorLoadDataOptions } from './contracts/PaginatorLoadDataOptions'
import { type PaginationDataDriverContract } from './contracts/PaginationDataDriverContract'
import { BasePaginator } from './BasePaginator'
import { StaleResponseException } from '../requests/exceptions/StaleResponseException'

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

  public load(pageNumber?: number, options?: PaginatorLoadDataOptions): Promise<PaginationDataDto<ResourceInterface[]>> {
    if (pageNumber !== undefined) {
      this.setPageNumber(pageNumber)
    }

    return this.loadData(this.getCurrentPage(), this.getPageSize(), options)
  }

  public setPageNumber(pageNumber: number): this {
    this.viewDriver.setPage(pageNumber)

    return this
  }

  public getLastPage(): number {
    return this.viewDriver.getLastPage()
  }

  public toNextPage(): Promise<PaginationDataDto<ResourceInterface[]>> {
    this.setPageNumber(this.getCurrentPage() + 1)

    return this.load()
  }

  public toFirstPage(): Promise<PaginationDataDto<ResourceInterface[]>> {
    this.setPageNumber(1)

    return this.load()
  }

  public toLastPage(): Promise<PaginationDataDto<ResourceInterface[]>> {
    this.setPageNumber(this.viewDriver.getLastPage())

    return this.load()
  }

  public toPreviousPage(): Promise<PaginationDataDto<ResourceInterface[]>> {
    this.setPageNumber(this.getCurrentPage() - 1)

    return this.load()
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

  public setPageSize(pageSize: number): this {
    this.viewDriver.setPageSize(pageSize)

    if (this.getCurrentPage() * pageSize > this.getTotal()) {
      this.setPageNumber(1)
    }

    return this
  }

  public getPages(): number[] {
    return this.viewDriver.getPages()
  }

  protected loadData(pageNumber: number, pageSize: number, options?: PaginatorLoadDataOptions): Promise<PaginationDataDto<ResourceInterface[]>> {
    return this.dataDriver
      .get(pageNumber, pageSize)
      .then((value: PaginationDataDto<ResourceInterface[]>) => {
        this.passDataToViewDriver(value, options)

        return value
      })
      .catch((error) => {
        if (error instanceof StaleResponseException) {
          return this.handleStaleResponse()
        }

        throw error
      })
  }
}
