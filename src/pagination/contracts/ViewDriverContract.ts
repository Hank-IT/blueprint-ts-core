import { type BaseViewDriverContract } from './BaseViewDriverContract'

export interface ViewDriverContract<ResourceInterface> extends BaseViewDriverContract<ResourceInterface> {
  getCurrentPage(): number
  setPage(value: number): void
  setPageSize(value: number): void
  getPageSize(): number
  getLastPage(): number
  getPages(): number[]
}
