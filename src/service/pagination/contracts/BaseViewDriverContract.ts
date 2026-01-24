export interface BaseViewDriverContract<ResourceInterface> {
  setData(data: ResourceInterface): void
  getData(): ResourceInterface
  setTotal(value: number): void
  getTotal(): number
}
