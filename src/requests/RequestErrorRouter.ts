import { BadRequestException } from './exceptions/BadRequestException'
import { MethodNotAllowedException } from './exceptions/MethodNotAllowedException'
import { RequestTimeoutException } from './exceptions/RequestTimeoutException'
import { ConflictException } from './exceptions/ConflictException'
import { GoneException } from './exceptions/GoneException'
import { PreconditionFailedException } from './exceptions/PreconditionFailedException'
import { PayloadTooLargeException } from './exceptions/PayloadTooLargeException'
import { UnsupportedMediaTypeException } from './exceptions/UnsupportedMediaTypeException'
import { ForbiddenException } from './exceptions/ForbiddenException'
import { LockedException } from './exceptions/LockedException'
import { NoResponseReceivedException } from './exceptions/NoResponseReceivedException'
import { NotFoundException } from './exceptions/NotFoundException'
import { NotImplementedException } from './exceptions/NotImplementedException'
import { BadGatewayException } from './exceptions/BadGatewayException'
import { PageExpiredException } from './exceptions/PageExpiredException'
import { ResponseBodyException } from './exceptions/ResponseBodyException'
import { ResponseException } from './exceptions/ResponseException'
import { ServerErrorException } from './exceptions/ServerErrorException'
import { ServiceUnavailableException } from './exceptions/ServiceUnavailableException'
import { GatewayTimeoutException } from './exceptions/GatewayTimeoutException'
import { TooManyRequestsException } from './exceptions/TooManyRequestsException'
import { UnauthorizedException } from './exceptions/UnauthorizedException'
import { ValidationException } from './exceptions/ValidationException'
import { InvalidJsonException } from './exceptions/InvalidJsonException'

type RequestExceptionConstructor =
  | typeof BadRequestException
  | typeof MethodNotAllowedException
  | typeof RequestTimeoutException
  | typeof ConflictException
  | typeof GoneException
  | typeof PreconditionFailedException
  | typeof PayloadTooLargeException
  | typeof UnsupportedMediaTypeException
  | typeof UnauthorizedException
  | typeof ForbiddenException
  | typeof NotFoundException
  | typeof PageExpiredException
  | typeof ValidationException
  | typeof LockedException
  | typeof TooManyRequestsException
  | typeof ServerErrorException
  | typeof NotImplementedException
  | typeof BadGatewayException
  | typeof ServiceUnavailableException
  | typeof GatewayTimeoutException
  | typeof NoResponseReceivedException
  | typeof InvalidJsonException
  | typeof ResponseBodyException
  | typeof ResponseException

type ErrorHandlerCallback<T extends Error> = (error: T) => void | Promise<void>

type UnknownErrorHandlerCallback = (error: unknown) => void | Promise<void>

export class RequestErrorRouter {
  protected handlers: Array<{ ctor: RequestExceptionConstructor; handler: ErrorHandlerCallback<Error> }> = []
  protected defaultHandler: UnknownErrorHandlerCallback | undefined = undefined

  public on<C extends RequestExceptionConstructor>(ctor: C, handler: ErrorHandlerCallback<InstanceType<C>>): this {
    this.handlers.push({ ctor, handler: handler as ErrorHandlerCallback<Error> })

    return this
  }

  public otherwise(handler: UnknownErrorHandlerCallback): this {
    this.defaultHandler = handler

    return this
  }

  public async handle(error: unknown): Promise<boolean> {
    for (const entry of this.handlers) {
      if (error instanceof entry.ctor) {
        await entry.handler(error)

        return true
      }
    }

    if (this.defaultHandler !== undefined) {
      await this.defaultHandler(error)

      return true
    }

    return false
  }
}
