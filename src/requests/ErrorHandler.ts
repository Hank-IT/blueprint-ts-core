import { PageExpiredException } from './exceptions/PageExpiredException'
import { NotFoundException } from './exceptions/NotFoundException'
import { UnauthorizedException } from './exceptions/UnauthorizedException'
import { ValidationException } from './exceptions/ValidationException'
import { ResponseException } from './exceptions/ResponseException'
import { NoResponseReceivedException } from './exceptions/NoResponseReceivedException'
import { ServerErrorException } from './exceptions/ServerErrorException'
import { type ResponseHandlerContract } from './drivers/contracts/ResponseHandlerContract'
import { ForbiddenException } from './exceptions/ForbiddenException'
import { TooManyRequestsException } from './exceptions/TooManyRequestsException'
import { LockedException } from './exceptions/LockedException'
import { NotImplementedException } from './exceptions/NotImplementedException'
import { ServiceUnavailableException } from './exceptions/ServiceUnavailableException'
import { MethodNotAllowedException } from './exceptions/MethodNotAllowedException'
import { RequestTimeoutException } from './exceptions/RequestTimeoutException'
import { ConflictException } from './exceptions/ConflictException'
import { GoneException } from './exceptions/GoneException'
import { PreconditionFailedException } from './exceptions/PreconditionFailedException'
import { PayloadTooLargeException } from './exceptions/PayloadTooLargeException'
import { UnsupportedMediaTypeException } from './exceptions/UnsupportedMediaTypeException'
import { BadGatewayException } from './exceptions/BadGatewayException'
import { GatewayTimeoutException } from './exceptions/GatewayTimeoutException'
import { BadRequestException } from './exceptions/BadRequestException'
import { InvalidJsonException } from './exceptions/InvalidJsonException'

export type ErrorHandlerCallback = ((response: ResponseHandlerContract) => boolean | void) | undefined

export class ErrorHandler<ResponseErrorBody> {
  protected body: ResponseErrorBody | undefined = undefined
  protected static handler: ErrorHandlerCallback = undefined

  public constructor(protected response: ResponseHandlerContract) {}

  public async handle() {
    // Check if there is a global error handler set
    if (ErrorHandler.handler !== undefined) {
      // If handler returns false, we don't process the error further
      if (ErrorHandler.handler(this.response) === false) {
        console.debug('Skipping further error handling due to global handler returning false.')
        return
      }
    }

    try {
      this.body = await this.response.json<ResponseErrorBody>()
    } catch (error) {
      throw new InvalidJsonException(this.response, error)
    }

    if (this.body === undefined) {
      throw new NoResponseReceivedException(this.response)
    }

    this.handleResponseError(this.response, this.body)
  }

  public static registerHandler(callback: ErrorHandlerCallback) {
    ErrorHandler.handler = callback
  }

  protected handleResponseError(response: ResponseHandlerContract, body: ResponseErrorBody) {
    if (response.getStatusCode() === 400) {
      throw new BadRequestException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 401) {
      throw new UnauthorizedException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 403) {
      throw new ForbiddenException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 404) {
      throw new NotFoundException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 405) {
      throw new MethodNotAllowedException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 408) {
      throw new RequestTimeoutException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 409) {
      throw new ConflictException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 410) {
      throw new GoneException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 412) {
      throw new PreconditionFailedException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 413) {
      throw new PayloadTooLargeException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 415) {
      throw new UnsupportedMediaTypeException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 419) {
      throw new PageExpiredException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 422) {
      throw new ValidationException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 423) {
      throw new LockedException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 429) {
      throw new TooManyRequestsException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 500) {
      throw new ServerErrorException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 501) {
      throw new NotImplementedException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 502) {
      throw new BadGatewayException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 503) {
      throw new ServiceUnavailableException<ResponseErrorBody>(response, body)
    }

    if (response.getStatusCode() === 504) {
      throw new GatewayTimeoutException<ResponseErrorBody>(response, body)
    }

    throw new ResponseException(response)
  }
}
