import { type HeadersContract } from './HeadersContract'

export interface BodyContract {
  getContent(): string | FormData

  getHeaders(): HeadersContract
}
