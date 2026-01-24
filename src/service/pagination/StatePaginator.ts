import { StatePaginationDataDto } from './dtos/StatePaginationDataDto'
import { type BaseViewDriverContract } from './contracts/BaseViewDriverContract'
import { type BaseViewDriverFactoryContract } from './contracts/BaseViewDriverFactoryContract'
import { type PaginatorLoadDataOptions } from './contracts/PaginatorLoadDataOptions'
import { type StatePaginationDataDriverContract } from './contracts/StatePaginationDataDriverContract'
import { BasePaginator } from './BasePaginator'

export interface StatePaginatorOptions {
  viewDriverFactory?: BaseViewDriverFactoryContract
}

export class StatePaginator<ResourceInterface> extends BasePaginator<ResourceInterface, BaseViewDriverContract<ResourceInterface[]>> {
  protected static viewDriverFactory: BaseViewDriverFactoryContract

  protected override viewDriver: BaseViewDriverContract<ResourceInterface[]>

  protected currentState: string | null = null

  public static setViewDriverFactory(value: BaseViewDriverFactoryContract): void {
    StatePaginator.viewDriverFactory = value
  }

  public constructor(
    protected override dataDriver: StatePaginationDataDriverContract<ResourceInterface[]>,
    options?: StatePaginatorOptions
  ) {
    super(dataDriver)
    this.viewDriver = options?.viewDriverFactory
      ? options.viewDriverFactory.make<ResourceInterface>()
      : StatePaginator.viewDriverFactory.make<ResourceInterface>()
  }

  public setDataDriver(dataDriver: StatePaginationDataDriverContract<ResourceInterface[]>): this {
    this.dataDriver = dataDriver

    return this
  }

  public getDataDriver(): StatePaginationDataDriverContract<ResourceInterface[]> {
    return this.dataDriver
  }

  public init(): Promise<StatePaginationDataDto<ResourceInterface[]>> {
    this.initialized = true
    this.currentState = null

    return this.loadData()
  }

  public refresh(options?: PaginatorLoadDataOptions): Promise<StatePaginationDataDto<ResourceInterface[]>> {
    this.currentState = null

    return this.loadData({ ...options, flush: true })
  }

  public loadNext(): Promise<StatePaginationDataDto<ResourceInterface[]>> {
    return this.loadData()
  }

  public hasNextPage(): boolean {
    return this.currentState !== null
  }

  public getCurrentState(): string | null {
    return this.currentState
  }

  protected loadData(options?: PaginatorLoadDataOptions): Promise<StatePaginationDataDto<ResourceInterface[]>> {
    return this.dataDriver.get(this.currentState).then((value: StatePaginationDataDto<ResourceInterface[]>) => {
      this.currentState = value.getState()
      this.passStateDataToViewDriver(value, options)

      return value
    })
  }

  protected passStateDataToViewDriver(dto: StatePaginationDataDto<ResourceInterface[]>, options?: PaginatorLoadDataOptions): void {
    const { flush = false, replace = false } = options || {}

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
