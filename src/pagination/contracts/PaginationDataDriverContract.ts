import { PaginationDataDto } from '../dtos/PaginationDataDto'

export interface PaginationDataDriverContract<ResourceInterface> {
  get(pageNumber: number, pageSize: number): Promise<PaginationDataDto<ResourceInterface>>
}
