import { JsonResponse } from '../../../requests/responses/JsonResponse'
import { type PaginationResponseBodyContract } from '../../pagination/contracts/PaginationResponseBodyContract'
import { type PaginationResponseContract } from '../../../pagination/contracts/PaginationResponseContract'

export class PaginationResponse<ResourceInterface>
  extends JsonResponse<PaginationResponseBodyContract<ResourceInterface>>
  implements PaginationResponseContract<PaginationResponseBodyContract<ResourceInterface>, ResourceInterface>
{
  public getTotal(): number {
    return this.getBody().meta.total
  }

  public getData(): ResourceInterface {
    return this.getBody().data
  }
}
