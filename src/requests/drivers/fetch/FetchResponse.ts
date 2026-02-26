import { type HeadersContract } from '../../contracts/HeadersContract'
import { type ResponseHandlerContract } from '../contracts/ResponseHandlerContract'

export class FetchResponse implements ResponseHandlerContract {
  public constructor(protected response: Response) {}

  public getStatusCode(): number | undefined {
    return this.response.status
  }

  public getHeaders(): HeadersContract {
    return Object.fromEntries(this.response.headers)
  }

  public getRawResponse(): Response {
    return this.response
  }

  public async json<ResponseBodyInterface>(): Promise<ResponseBodyInterface> {
    return await this.response.json()
  }

  public async text(): Promise<string> {
    return await this.response.text()
  }

  public async blob(): Promise<Blob> {
    return await this.response.blob()
  }
}
