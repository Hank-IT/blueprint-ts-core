import { type HeadersContract } from './HeadersContract'

export interface DriverConfigContract {
  corsWithCredentials?: boolean | undefined
  abortSignal?: AbortSignal | undefined
  headers?: HeadersContract | undefined
}
