import { type HeadersContract } from '../../contracts/HeadersContract'

export interface ResponseHandlerContract {
  getStatusCode(): number | undefined
  getHeaders(): HeadersContract
  getRawResponse(): Response
  json<ResponseBodyInterface>(): Promise<ResponseBodyInterface>
  text(): Promise<string>
  blob(): Promise<Blob>
}
