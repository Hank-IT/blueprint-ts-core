import { type ResponseHandlerContract } from '../drivers/contracts/ResponseHandlerContract'

export class ResponseException extends Error {
  constructor(protected response: ResponseHandlerContract) {
    super()
  }

  public getResponse(): ResponseHandlerContract {
    return this.response
  }
}
