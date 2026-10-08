export interface BaseViewDriverContract<ResourceInterface> {
  isInitialized(): boolean
  setInitialized(value: boolean): void
  setData(data: ResourceInterface): void
  getData(): ResourceInterface
  setTotal(value: number): void
  getTotal(): number
}
