import type { RequestContext } from './RequestContext'
import type { RequestMethodEnum } from '../RequestMethod.enum'
import type { HeadersContract } from '../contracts/HeadersContract'
import type { ResponseHandlerContract } from '../drivers/contracts/ResponseHandlerContract'
import type { RequestUploadProgress } from './RequestUploadProgress'
import { RequestEvents } from '../RequestEvents.enum'

export interface RequestSnapshot {
  readonly requestId: string
  readonly sendId: string
  readonly url: string
  readonly method: RequestMethodEnum
  readonly context: RequestContext
}

export interface RequestPreparation {
  body: unknown
  headers: HeadersContract
}

export interface RequestEventArguments {
  [RequestEvents.BEFORE_SERIALIZE]: [request: RequestSnapshot, preparation: RequestPreparation]
  [RequestEvents.RESPONSE_ERROR]: [request: RequestSnapshot, response: ResponseHandlerContract]
  [RequestEvents.RECEIVED]: [request: RequestSnapshot, response: ResponseHandlerContract]
  [RequestEvents.DECODED]: [request: RequestSnapshot, body: unknown, response: ResponseHandlerContract]
  [RequestEvents.FAILED]: [request: RequestSnapshot, error: unknown]
  [RequestEvents.LOADING]: [loading: boolean, request: RequestSnapshot]
  [RequestEvents.UPLOAD_PROGRESS]: [progress: RequestUploadProgress, request: RequestSnapshot]
}

type RequestEventResult<Event extends RequestEvents> = Event extends RequestEvents.RESPONSE_ERROR ? boolean | void : void
export type RequestEventHandler<Event extends RequestEvents> = (
  ...args: RequestEventArguments[Event]
) => RequestEventResult<Event> | Promise<RequestEventResult<Event>>
export type RequestListenerErrorHandler = (error: unknown, event: RequestEvents, request: RequestSnapshot) => void | Promise<void>
