import { type ResponseContract } from '../../requests/contracts/ResponseContract'

export interface PaginationResponseContract<ResponseBodyInterface, ResourceInterface> extends ResponseContract<ResponseBodyInterface> {
  getData(): ResourceInterface

  getTotal(): number
}
