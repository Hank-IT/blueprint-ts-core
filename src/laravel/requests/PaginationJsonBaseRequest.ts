import { BaseRequest } from '../../requests/BaseRequest'
import { type PaginationResponseBodyContract } from '../pagination/contracts/PaginationResponseBodyContract'
import { type PaginationResponseContract } from '../../pagination/contracts/PaginationResponseContract'
import { PaginationResponse } from './responses/PaginationResponse'

export abstract class PaginationJsonBaseRequest<
  RequestLoaderLoadingType,
  ResponseErrorBodyInterface,
  ResourceInterface,
  RequestParamsInterface extends object
> extends BaseRequest<
  RequestLoaderLoadingType,
  ResponseErrorBodyInterface,
  PaginationResponseBodyContract<ResourceInterface>,
  PaginationResponseContract<PaginationResponseBodyContract<ResourceInterface>, ResourceInterface>,
  undefined,
  RequestParamsInterface
> {
  public getResponse(): PaginationResponse<ResourceInterface> {
    return new PaginationResponse()
  }

  public setPaginationParams(page: number, size: number): this {
    return this.withParams({
      page_number: page,
      page_size: size
    } as RequestParamsInterface)
  }
}
