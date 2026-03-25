import { type HeadersContract } from './HeadersContract'

export type BodyContent = string | FormData | Blob | ArrayBuffer | ArrayBufferView<ArrayBuffer>

export interface BodyContract {
  getContent(): BodyContent

  getHeaders(): HeadersContract
}
