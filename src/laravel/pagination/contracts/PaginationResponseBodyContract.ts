export interface PaginationResponseBodyContract<ResourceInterface> {
  data: ResourceInterface
  meta: {
    total: number
  }
}
