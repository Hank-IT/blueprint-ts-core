import { type HeadersContract } from './HeadersContract'
import { type RequestUploadProgress } from '../types/RequestUploadProgress'

export interface DriverConfigContract {
  corsWithCredentials?: boolean | undefined
  abortSignal?: AbortSignal | undefined
  headers?: HeadersContract | undefined
  onUploadProgress?: ((progress: RequestUploadProgress) => void) | undefined
}
