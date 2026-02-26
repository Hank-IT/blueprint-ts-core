import { type ResponseHandlerContract } from '../drivers/contracts/ResponseHandlerContract'
import { type HeadersContract } from '../contracts/HeadersContract'
import { type ResponseContract } from '../contracts/ResponseContract'

export abstract class BaseResponse<ResponseInterface> implements ResponseContract<ResponseInterface> {
  private body?: ResponseInterface

  protected response?: ResponseHandlerContract

  public abstract getAcceptHeader(): string

  protected abstract resolveBody(): Promise<ResponseInterface>

  public async setResponse(response: ResponseHandlerContract): Promise<ResponseInterface> {
    this.response = response

    this.body = await this.resolveBody()

    return this.body
  }

  public getRawResponse(): Response | undefined {
    return this.response?.getRawResponse()
  }

  public getStatusCode(): number | undefined {
    return this.response?.getStatusCode()
  }

  public getHeaders(): HeadersContract | undefined {
    return this.response?.getHeaders()
  }

  public getBody(): ResponseInterface {
    if (this.body === undefined) {
      throw new Error('Response body is not set')
    }

    return this.body
  }
}
