import { PaginationDataDto } from '../../../pagination/dtos/PaginationDataDto'
import { PaginationResponse } from '../../requests/responses/PaginationResponse'
import { type PaginateableRequestContract } from '../../../pagination/contracts/PaginateableRequestContract'
import { type PaginationDataDriverContract } from '../../../pagination/contracts/PaginationDataDriverContract'

export class RequestDriver<
  Resource,
  TReq extends PaginateableRequestContract<unknown, PaginationResponse<Resource>, unknown, object> = PaginateableRequestContract<
    unknown,
    PaginationResponse<Resource>,
    unknown,
    object
  >
> implements PaginationDataDriverContract<Resource> {
  public constructor(protected request: TReq) {}

  public get(pageNumber: number, pageSize: number): Promise<PaginationDataDto<Resource>> {
    return this.request
      .setPaginationParams(pageNumber, pageSize)
      .send()
      .then((response) => {
        const paginationResponse = response as PaginationResponse<Resource>
        return new PaginationDataDto<Resource>(paginationResponse.getData(), paginationResponse.getTotal())
      })
  }

  public getRequest(): TReq {
    return this.request
  }
}
