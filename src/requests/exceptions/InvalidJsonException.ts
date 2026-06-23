import { ResponseException } from './ResponseException'
import { type ResponseHandlerContract } from '../drivers/contracts/ResponseHandlerContract'

export class InvalidJsonException extends ResponseException {
  public constructor(
    response: ResponseHandlerContract,
    public override cause: unknown
  ) {
    super(response)
  }

  public getCause(): unknown {
    return this.cause
  }
}
