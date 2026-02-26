import { type BaseRequestContract } from '../../requests/contracts/BaseRequestContract'

export interface PaginateableRequestContract<
  RequestLoaderLoadingType,
  ResponseClass,
  RequestBodyInterface,
  RequestParamsInterface extends object
> extends BaseRequestContract<RequestLoaderLoadingType, ResponseClass, RequestBodyInterface, RequestParamsInterface> {
  setPaginationParams(
    page: number,
    size: number
  ): BaseRequestContract<RequestLoaderLoadingType, ResponseClass, RequestBodyInterface, RequestParamsInterface>
}
