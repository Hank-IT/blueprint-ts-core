import type { RequestContext } from '../types/RequestContext'
import type { RequestClient } from '../RequestClient'
import type { RequestEventHandler } from '../types/RequestLifecycle'
import { RequestMethodEnum } from '../RequestMethod.enum'
import { RequestEvents } from '../RequestEvents.enum'
import { type BodyFactoryContract } from './BodyFactoryContract'
import { type HeadersContract } from './HeadersContract'
import { type RequestConcurrencyOptions } from '../types/RequestConcurrencyOptions'
import { type ResponseHandlerContract } from '../drivers/contracts/ResponseHandlerContract'
import { type RequestDriverContract } from './RequestDriverContract'

export interface SendRequestOptions {
  resolveBody?: boolean
  keepalive?: boolean
  loading?: boolean
  globalErrorHandling?: boolean
  detached?: boolean
}

export interface BaseRequestContract<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface extends object> {
  method(): RequestMethodEnum

  url(): URL | string

  setParams(params?: RequestParamsInterface): this

  withParams(params?: RequestParamsInterface): this

  getParams(): RequestParamsInterface | undefined

  setBody(requestBody: RequestBodyInterface | undefined): this

  setContext(context: RequestContext): this

  getContext(): RequestContext

  setClient(client: RequestClient): this

  getClient(): RequestClient

  requestHeaders(): HeadersContract

  buildUrl(): URL

  on<Event extends RequestEvents>(event: Event, handler: RequestEventHandler<Event>): () => void

  send(): Promise<ResponseClass>
  send(options: SendRequestOptions & { resolveBody?: true }): Promise<ResponseClass>
  send(options: SendRequestOptions & { resolveBody: false }): Promise<ResponseHandlerContract>

  isLoading(): RequestLoaderLoadingType

  getRequestBodyFactory(): BodyFactoryContract<RequestBodyInterface> | undefined

  getResponse(): ResponseClass

  setAbortSignal(signal: AbortSignal): this

  setConcurrency(options?: RequestConcurrencyOptions): this

  setRequestDriver(driver: RequestDriverContract): this
}
