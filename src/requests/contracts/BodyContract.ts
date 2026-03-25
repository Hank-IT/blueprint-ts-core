import { type HeadersContract } from './HeadersContract'

export type BodyContent = string | FormData | Blob | BufferSource

export interface BodyContract {
  getContent(): BodyContent

  getHeaders(): HeadersContract
}
