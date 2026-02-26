import { ResponseException } from './ResponseException'
import { type ResponseHandlerContract } from '../drivers/contracts/ResponseHandlerContract'

export class ResponseBodyException<ResponseErrorBody> extends ResponseException {
  public constructor(
    response: ResponseHandlerContract,
    protected body: ResponseErrorBody
  ) {
    super(response)
  }

  public getBody(): ResponseErrorBody {
    return this.body
  }
}
