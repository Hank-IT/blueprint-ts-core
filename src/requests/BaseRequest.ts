import { RequestContext } from './types/RequestContext'
import { snapshotRequestBody } from './snapshotRequestBody'
import { RequestClient } from './RequestClient'
import { RequestSubscriptions } from './RequestSubscriptions'
import type { RequestEventHandler, RequestSnapshot, RequestPreparation } from './types/RequestLifecycle'
import qs from 'qs'
import { ErrorHandler } from './ErrorHandler'
import { RequestEvents } from './RequestEvents.enum'
import { RequestMethodEnum } from './RequestMethod.enum'
import { BaseResponse } from './responses/BaseResponse'
import { ResponseException } from './exceptions/ResponseException'
import { type DriverConfigContract } from './contracts/DriverConfigContract'
import { type BodyFactoryContract } from './contracts/BodyFactoryContract'
import { type BodyContract } from './contracts/BodyContract'
import { type RequestLoaderContract } from './contracts/RequestLoaderContract'
import { type RequestDriverContract } from './contracts/RequestDriverContract'
import { type BaseRequestContract, type SendRequestOptions } from './contracts/BaseRequestContract'
import { type HeadersContract } from './contracts/HeadersContract'
import { type ResponseHandlerContract } from './drivers/contracts/ResponseHandlerContract'
import { type ResponseContract } from './contracts/ResponseContract'
import { type RequestConcurrencyOptions } from './types/RequestConcurrencyOptions'
import { type RequestUploadProgress } from './types/RequestUploadProgress'
import { mergeDeep } from '../support/helpers'
import { v4 as uuidv4 } from 'uuid'

export abstract class BaseRequest<
  RequestLoaderLoadingType,
  ResponseErrorBody,
  ResponseBodyInterface = undefined,
  ResponseClass extends ResponseContract<ResponseBodyInterface> = BaseResponse<ResponseBodyInterface>,
  RequestBodyInterface = undefined,
  RequestParamsInterface extends object = object
> implements BaseRequestContract<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface> {
  private context = new RequestContext()
  private readonly subscriptions = new RequestSubscriptions()
  private activeSends = 0
  private loadingSends = 0
  private explicitLoader = false

  protected requestId: string = uuidv4()
  protected params: RequestParamsInterface | undefined
  protected requestBody: RequestBodyInterface | undefined
  protected requestLoader: RequestLoaderContract<RequestLoaderLoadingType> | undefined
  protected abortSignal: AbortSignal | undefined
  protected concurrencyOptions: RequestConcurrencyOptions | undefined
  protected additionalHeaders: HeadersContract = {}
  protected instanceRequestDriver: RequestDriverContract | undefined

  public constructor(private client: RequestClient = RequestClient.getDefault()) {
    this.requestLoader = client.getLoaderFactory()?.make() as RequestLoaderContract<RequestLoaderLoadingType> | undefined
  }

  public static setDefaultClient(client: RequestClient): void {
    RequestClient.setDefault(client)
  }
  public static getDefaultClient(): RequestClient {
    return RequestClient.getDefault()
  }
  public getClient(): RequestClient {
    return this.client
  }
  public setClient(client: RequestClient): this {
    if (this.activeSends > 0) throw new Error('Cannot change the client while a request is running.')
    this.client = client
    if (!this.explicitLoader) this.requestLoader = client.getLoaderFactory()?.make() as RequestLoaderContract<RequestLoaderLoadingType> | undefined
    return this
  }

  public setRequestLoader(loader: RequestLoaderContract<RequestLoaderLoadingType>): this {
    this.requestLoader = loader
    this.explicitLoader = true

    return this
  }

  public setConcurrency(options?: RequestConcurrencyOptions): this {
    this.concurrencyOptions = options

    return this
  }

  public setRequestDriver(driver: RequestDriverContract): this {
    this.instanceRequestDriver = driver

    return this
  }

  public getRequestId(): string {
    return this.requestId
  }

  public abstract method(): RequestMethodEnum

  public abstract url(): URL | string

  public setParams(params?: RequestParamsInterface): this {
    this.params = params

    return this
  }

  public withParams(params: RequestParamsInterface): this {
    this.params = this.params === undefined ? params : (mergeDeep({}, this.params, params) as RequestParamsInterface)

    return this
  }

  public getParams(): RequestParamsInterface | undefined {
    return this.params
  }

  public setBody(requestBody: RequestBodyInterface): this {
    this.requestBody = requestBody

    return this
  }

  public setContext(context: RequestContext): this {
    this.context = context
    return this
  }

  public getContext(): RequestContext {
    return this.context
  }

  public setHeaders(headers: HeadersContract): this {
    this.additionalHeaders = {
      ...this.additionalHeaders,
      ...headers
    }

    return this
  }

  public getBody(): RequestBodyInterface | undefined {
    return this.requestBody
  }

  public requestHeaders(): HeadersContract {
    return {}
  }

  public buildUrl(): URL {
    const hasParams = this.params !== undefined && Object.keys(this.params).length > 0
    const url = hasParams ? this.url() + '?' + qs.stringify(this.params) : this.url()

    return new URL(url, this.baseUrl() ?? this.client.getBaseUrl())
  }

  public on<Event extends RequestEvents>(event: Event, handler: RequestEventHandler<Event>): () => void {
    return this.subscriptions.on(event, handler)
  }

  public async send(): Promise<ResponseClass>
  public async send(options: SendRequestOptions & { resolveBody?: true }): Promise<ResponseClass>
  public async send(options: SendRequestOptions & { resolveBody: false }): Promise<ResponseHandlerContract>
  public async send(options: SendRequestOptions = {}): Promise<ResponseClass | ResponseHandlerContract> {
    const responseSkeleton = this.getResponse()
    const snapshot: RequestSnapshot = Object.freeze({
      requestId: this.requestId,
      sendId: uuidv4(),
      url: this.buildUrl().toString(),
      method: this.method(),
      context: this.context
    })
    const shared = this.client.snapshotSubscriptions()
    const local = this.subscriptions.snapshot()
    const subscriptions = shared.snapshot()
    subscriptions.append(local)
    const report = this.client.reportListenerError.bind(this.client)
    const operation = this.client.begin(snapshot, this.concurrencyOptions, options.detached === true)
    const { controller, assertCurrent } = operation
    this.activeSends++
    let externalSignal: AbortSignal | undefined
    const abort = () => controller.abort()
    const loading = options.loading !== false
    let loadingStarted = false
    let skipSharedFailure = options.globalErrorHandling === false
    try {
      const preparation: RequestPreparation = {
        body: snapshotRequestBody(this.requestBody),
        headers: { ...this.client.getHeaders(), Accept: responseSkeleton.getAcceptHeader(), ...this.requestHeaders(), ...this.additionalHeaders }
      }
      const config = { ...this.client.getConfig(), ...this.getConfig() }
      externalSignal = options.detached ? undefined : config.abortSignal
      if (externalSignal?.aborted) abort()
      externalSignal?.addEventListener('abort', abort, { once: true })
      if (options.keepalive !== undefined) config.keepalive = options.keepalive
      config.abortSignal = options.detached ? undefined : controller.signal
      assertCurrent()
      if (loading) {
        this.loadingSends++
        loadingStarted = true
        this.requestLoader?.setLoading(true)
        subscriptions.notify(RequestEvents.LOADING, [true, snapshot], snapshot, report)
      }
      const preparing = subscriptions.process(RequestEvents.BEFORE_SERIALIZE, [snapshot, preparation], assertCurrent)
      if (preparing !== undefined) await preparing
      assertCurrent()
      const body = preparation.body === undefined ? undefined : this.getRequestBodyFactory()?.make(preparation.body as RequestBodyInterface)
      const requestConfig = this.buildRequestConfig(
        body,
        config,
        operation.isCurrent,
        (error) => report(error, RequestEvents.UPLOAD_PROGRESS, snapshot),
        (progress) => {
          subscriptions.notify(RequestEvents.UPLOAD_PROGRESS, [progress, snapshot], snapshot, report)
        }
      )
      let transportError: ResponseException | undefined
      let response: ResponseHandlerContract
      try {
        response = await this.resolveRequestDriver().send(snapshot.url, snapshot.method, preparation.headers, body, requestConfig)
      } catch (error) {
        if (!(error instanceof ResponseException)) throw error
        transportError = error
        response = error.getResponse()
      }
      assertCurrent()
      if (transportError !== undefined || (response.getStatusCode() ?? 0) >= 400) {
        const errorSubscriptions = options.globalErrorHandling === false ? local : subscriptions
        const processing = errorSubscriptions.process(RequestEvents.RESPONSE_ERROR, [snapshot, response], assertCurrent)
        const proceed = processing === undefined ? undefined : await processing
        assertCurrent()
        if (proceed === false) {
          skipSharedFailure = true
          throw transportError ?? new ResponseException(response)
        }
        await new ErrorHandler<ResponseErrorBody>(response).handle()
        throw transportError ?? new ResponseException(response)
      }
      const received = subscriptions.process(RequestEvents.RECEIVED, [snapshot, response], assertCurrent)
      if (received !== undefined) await received
      assertCurrent()
      if (options.resolveBody === false) return response
      const decoded = await responseSkeleton.setResponse(response)
      assertCurrent()
      const processed = subscriptions.process(RequestEvents.DECODED, [snapshot, decoded, response], assertCurrent)
      if (processed !== undefined) await processed
      assertCurrent()
      return responseSkeleton
    } catch (error) {
      assertCurrent()
      if (!skipSharedFailure) shared.notify(RequestEvents.FAILED, [snapshot, error], snapshot, report)
      local.notify(RequestEvents.FAILED, [snapshot, error], snapshot, report)
      throw error
    } finally {
      try {
        if (loadingStarted && --this.loadingSends === 0) {
          try {
            this.requestLoader?.setLoading(false)
          } finally {
            subscriptions.notify(RequestEvents.LOADING, [false, snapshot], snapshot, report)
          }
        }
      } finally {
        externalSignal?.removeEventListener('abort', abort)
        operation.finish()
        this.activeSends--
      }
    }
  }

  public isLoading(): RequestLoaderLoadingType {
    if (!this.requestLoader) {
      throw new Error('Request loader is not set.')
    }

    return this.requestLoader.isLoading()
  }

  public abstract getResponse(): ResponseClass

  public getRequestBodyFactory(): BodyFactoryContract<RequestBodyInterface | undefined> | undefined {
    return undefined
  }

  public setAbortSignal(signal: AbortSignal): this {
    this.abortSignal = signal

    return this
  }

  protected baseUrl(): undefined {
    return undefined
  }

  private buildRequestConfig(
    requestBody: BodyContract | undefined,
    config: DriverConfigContract,
    isCurrent: () => boolean,
    report: (error: unknown) => void,
    notify: (progress: RequestUploadProgress) => void
  ): DriverConfigContract {
    if (requestBody === undefined) return config
    const onUploadProgress = config.onUploadProgress
    return {
      ...config,
      onUploadProgress: (progress) => {
        if (!isCurrent()) return
        // Driver configuration callbacks are notifications too.
        if (onUploadProgress !== undefined) {
          try {
            void Promise.resolve(onUploadProgress(progress)).catch(report)
          } catch (error) {
            report(error)
          }
        }
        notify(progress)
      }
    }
  }

  protected getConfig(): DriverConfigContract | undefined {
    return this.abortSignal === undefined ? undefined : { abortSignal: this.abortSignal }
  }

  protected resolveRequestDriver(): RequestDriverContract {
    return this.instanceRequestDriver ?? this.client.getTransportOverride() ?? this.getRequestDriver() ?? this.client.getDriver()
  }

  protected getRequestDriver(): RequestDriverContract | undefined {
    return undefined
  }
}
