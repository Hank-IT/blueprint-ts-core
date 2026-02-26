import { StatePaginationDataDto } from '../dtos/StatePaginationDataDto'

export interface StatePaginationDataDriverContract<ResourceInterface> {
  get(state?: string | null): Promise<StatePaginationDataDto<ResourceInterface>>
}
