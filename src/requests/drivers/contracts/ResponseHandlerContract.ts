import { type ResolvedHeadersContract } from '../../contracts/HeadersContract'

export interface ResponseHandlerContract {
  getStatusCode(): number | undefined
  getHeaders(): ResolvedHeadersContract
  getRawResponse(): Response
  json<ResponseBodyInterface>(): Promise<ResponseBodyInterface>
  text(): Promise<string>
  blob(): Promise<Blob>
}
