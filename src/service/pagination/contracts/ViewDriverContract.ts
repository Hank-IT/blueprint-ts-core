export interface ViewDriverContract<ResourceInterface> {
  setData(data: ResourceInterface): void
  setTotal(value: number): void
  getData(): ResourceInterface
  getCurrentPage(): number
  setPage(value: number): void
  setPageSize(value: number): void
  getPageSize(): number
  getLastPage(): number
  getPages(): number[]
  getTotal(): number
}
