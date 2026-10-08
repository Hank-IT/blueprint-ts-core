import { type HeadersContract } from './HeadersContract'
import { type RequestUploadProgress } from '../types/RequestUploadProgress'

export interface DriverConfigContract {
  keepalive?: boolean | undefined
  corsWithCredentials?: boolean | undefined
  abortSignal?: AbortSignal | undefined
  headers?: HeadersContract | undefined
  onUploadProgress?: ((progress: RequestUploadProgress) => void) | undefined
}
