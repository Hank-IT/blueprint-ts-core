import { RequestConcurrencyMode } from '../RequestConcurrencyMode.enum'

export type RequestConcurrencyOptions = {
  mode?: RequestConcurrencyMode
  key?: string
}
