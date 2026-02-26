import type { ResponseHandlerContract } from '../drivers/contracts/ResponseHandlerContract'

export interface ResponseContract<ResponseBodyInterface> {
  getAcceptHeader(): string

  setResponse(response: ResponseHandlerContract): Promise<ResponseBodyInterface>
}
