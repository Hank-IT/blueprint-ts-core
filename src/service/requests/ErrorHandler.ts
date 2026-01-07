import { PageExpiredException } from './exceptions/PageExpiredException'
import { NotFoundException } from './exceptions/NotFoundException'
import { UnauthorizedException } from './exceptions/UnauthorizedException'
import { ValidationException } from './exceptions/ValidationException'
import { ResponseException } from './exceptions/ResponseException'
import { NoResponseReceivedException } from './exceptions/NoResponseReceivedException'
import { ServerErrorException } from './exceptions/ServerErrorException'
import { type ResponseHandlerContract } from './drivers/contracts/ResponseHandlerContract'

export type ErrorHandlerCallback = ((response: ResponseHandlerContract) => boolean | void) | undefined

export class ErrorHandler<ResponseErrorBody> {
  protected body: ResponseErrorBody | undefined = undefined
  protected static handler: ErrorHandlerCallback = undefined

  public constructor(protected response: ResponseHandlerContract) {
    // Check if there is a global error handler set
    if (ErrorHandler.handler !== undefined) {
      // If handler returns false, we don't process the error further
      if (ErrorHandler.handler(response) === false) {
        console.debug('Skipping further error handling due to global handler returning false.')
        return
      }
    }
  }

  public async handle() {
    this.body = await this.response.json<ResponseErrorBody>()

    if (this.body === undefined) {
      throw new NoResponseReceivedException(this.response)
    }

    this.handleResponseError(this.response, this.body)
  }

  public static registerHandler(callback: ErrorHandlerCallback) {
    ErrorHandler.handler = callback
  }

  protected handleResponseError(response: ResponseHandlerContract, body: ResponseErrorBody) {
    if (response.getStatusCode() === 401) {
      throw new UnauthorizedException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 404) {
      throw new NotFoundException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 419) {
      throw new PageExpiredException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 422) {
      throw new ValidationException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 500) {
      throw new ServerErrorException<ResponseErrorBody>(response, body)
    }

    throw new ResponseException(response)
  }
}
