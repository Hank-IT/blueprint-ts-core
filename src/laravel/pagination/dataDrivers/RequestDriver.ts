import { PaginationDataDto } from '../../../pagination/dtos/PaginationDataDto'
import { PaginationJsonBaseRequest } from '../../requests/PaginationJsonBaseRequest'
import { PaginationResponse } from '../../requests/responses/PaginationResponse'
import { type PaginateableRequestContract } from '../../../pagination/contracts/PaginateableRequestContract'
import { type PaginationDataDriverContract } from '../../../pagination/contracts/PaginationDataDriverContract'

type ExtractRequestTypes<T> =
  T extends PaginationJsonBaseRequest<any, undefined, infer Resource, object>
    ? {
        Resource: Resource
      }
    : never

export class RequestDriver<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TReq extends PaginateableRequestContract<any, any, any, any>
> implements PaginationDataDriverContract<ExtractRequestTypes<TReq>['Resource']> {
  public constructor(protected request: TReq) {}

  public get(pageNumber: number, pageSize: number): Promise<PaginationDataDto<ExtractRequestTypes<TReq>['Resource']>> {
    return this.request
      .setPaginationParams(pageNumber, pageSize)
      .send()
      .then((response: PaginationResponse<ExtractRequestTypes<TReq>['Resource']>) => {
        return new PaginationDataDto<ExtractRequestTypes<TReq>['Resource']>(response.getData(), response.getTotal())
      })
  }

  public getRequest(): TReq {
    return this.request
  }
}
