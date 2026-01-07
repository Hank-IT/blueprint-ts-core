import { PaginationDataDto } from './dtos/PaginationDataDto'
import { type ViewDriverContract } from './contracts/ViewDriverContract'
import { type ViewDriverFactoryContract } from './contracts/ViewDriverFactoryContract'
import { type PaginatorLoadDataOptions } from './contracts/PaginatorLoadDataOptions'
import { type PaginationDataDriverContract } from './contracts/PaginationDataDriverContract'

export interface PaginatorOptions {
  viewDriverFactory?: ViewDriverFactoryContract
}

export class Paginator<ResourceInterface> {
  protected initialized: boolean = false

  protected static viewDriverFactory: ViewDriverFactoryContract

  protected viewDriver: ViewDriverContract<ResourceInterface[]>

  public static setViewDriverFactory(value: ViewDriverFactoryContract): void {
    Paginator.viewDriverFactory = value
  }

  public constructor(
    protected dataDriver: PaginationDataDriverContract<ResourceInterface[]>,
    pageNumber: number = 1,
    pageSize: number = 10,
    options?: PaginatorOptions
  ) {
    this.viewDriver = options?.viewDriverFactory
      ? options.viewDriverFactory.make<ResourceInterface>(pageNumber, pageSize)
      : Paginator.viewDriverFactory.make<ResourceInterface>(pageNumber, pageSize)
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

  public flush(): void {
    this.viewDriver.setData([])
  }

  public setPage(pageNumber: number, options?: PaginatorLoadDataOptions): Promise<PaginationDataDto<ResourceInterface[]>> {
    this.viewDriver.setPage(pageNumber)

    return this.loadData(this.viewDriver.getCurrentPage(), this.viewDriver.getPageSize(), options)
  }

  public isInitialized(): boolean {
    return this.initialized
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

  public getPageData(): ResourceInterface[] {
    return this.viewDriver.getData()
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

  public getTotal(): number {
    return this.viewDriver.getTotal()
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

  protected passDataToViewDriver(dto: PaginationDataDto<ResourceInterface[]>, options?: PaginatorLoadDataOptions): void {
    if (options?.flush) {
      this.flush()
    }

    this.viewDriver.setData(dto.getData())
    this.viewDriver.setTotal(dto.getTotal())
  }
}
