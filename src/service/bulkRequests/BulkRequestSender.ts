import { BulkRequestWrapper } from './BulkRequestWrapper'
import { BulkRequestEventEnum } from './BulkRequestEvent.enum'

export enum BulkRequestExecutionMode {
  PARALLEL = 'parallel',
  SEQUENTIAL = 'sequential'
}

export class BulkRequestSender<
  RequestLoaderLoadingType = unknown,
  RequestBodyInterface = unknown,
  ResponseClass = unknown,
  RequestParamsInterface extends object = object
> {
  protected events: Map<
    BulkRequestEventEnum,
    ((req: BulkRequestWrapper<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface>) => void)[]
  > = new Map()
  protected abortController: AbortController | undefined = undefined

  public constructor(
    protected requests: BulkRequestWrapper<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface>[] = [],
    protected executionMode: BulkRequestExecutionMode = BulkRequestExecutionMode.PARALLEL,
    protected retryCount: number = 0
  ) {}

  public setRequests(requests: BulkRequestWrapper<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface>[] = []) {
    this.requests = requests

    return this
  }

  public setExecutionMode(mode: BulkRequestExecutionMode): this {
    this.executionMode = mode

    return this
  }

  public setRetryCount(count: number): this {
    this.retryCount = count

    return this
  }

  public get isLoading(): boolean {
    return this.requests.some((req) => Boolean(req.isLoading() as unknown))
  }

  public on(
    event: BulkRequestEventEnum,
    callback: (req: BulkRequestWrapper<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface>) => void
  ): this {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }

    this.events.get(event)!.push(callback)

    return this
  }

  public off(event: BulkRequestEventEnum): this {
    this.events.delete(event)

    return this
  }

  protected emit(
    event: BulkRequestEventEnum,
    req: BulkRequestWrapper<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface>
  ): void {
    const callbacks = this.events.get(event) || []

    callbacks.forEach((callback) => callback(req))
  }

  public get signal(): AbortSignal | undefined {
    return this.abortController?.signal
  }

  public abort(): void {
    this.abortController?.abort()
  }

  public async send() {
    this.abortController = new AbortController()

    try {
      if (this.executionMode === BulkRequestExecutionMode.PARALLEL) {
        await this.sendParallel()
      } else {
        await this.sendSequential()
      }
    } catch (error) {
      // If an abort occurs, the underlying fetch (or request mechanism) should throw an AbortError.
      console.error('Bulk operation aborted or encountered an error:', error)
    }

    return {
      getSuccessCount: () => this.requests.filter((r) => !r.hasError()).length,
      getErrorCount: () => this.requests.filter((r) => r.hasError()).length,
      getSuccessfulResponses: () =>
        this.requests
          .filter((r) => !r.hasError())
          .map((r) => r.getResponse())
          .filter((response): response is ResponseClass => response !== null),
      getFailedResponses: () => this.requests.filter((r) => r.hasError()).map((r) => r.getError())
    }
  }

  protected async sendParallel() {
    // First attempt for all requests
    await Promise.all(
      this.requests.map((req) =>
        req.send(this.abortController?.signal).then(() => {
          if (!req.hasError()) {
            this.emit(BulkRequestEventEnum.REQUEST_SUCCESSFUL, req)
          }
        })
      )
    )

    // Retry logic for failed requests
    let retriesLeft = this.retryCount
    while (retriesLeft > 0) {
      const failedRequests = this.requests.filter((req) => req.hasError())

      if (failedRequests.length === 0) {
        break // No failed requests to retry
      }

      console.log(`Retrying ${failedRequests.length} failed requests. Attempts left: ${retriesLeft}`)

      await Promise.all(
        failedRequests.map((req) =>
          req.send(this.abortController?.signal).then(() => {
            if (!req.hasError()) {
              // Success after retry
              this.emit(BulkRequestEventEnum.REQUEST_SUCCESSFUL, req)
            }
          })
        )
      )

      retriesLeft--
    }

    // Emit failed events for any requests that still have errors after all retries
    this.requests
      .filter((req) => req.hasError())
      .forEach((req) => {
        this.emit(BulkRequestEventEnum.REQUEST_FAILED, req)
      })
  }

  protected async sendSequential() {
    // First attempt for all requests
    for (const req of this.requests) {
      await req.send(this.abortController?.signal)

      if (!req.hasError()) {
        this.emit(BulkRequestEventEnum.REQUEST_SUCCESSFUL, req)
      }
    }

    // Retry logic for failed requests
    let retriesLeft = this.retryCount
    while (retriesLeft > 0) {
      const failedRequests = this.requests.filter((req) => req.hasError())

      if (failedRequests.length === 0) {
        break // No failed requests to retry
      }

      console.log(`Retrying ${failedRequests.length} failed requests sequentially. Attempts left: ${retriesLeft}`)

      for (const req of failedRequests) {
        await req.send(this.abortController?.signal)

        if (!req.hasError()) {
          // Success after retry
          this.emit(BulkRequestEventEnum.REQUEST_SUCCESSFUL, req)
        }
      }

      retriesLeft--
    }

    // Emit failed events for any requests that still have errors after all retries
    this.requests
      .filter((req) => req.hasError())
      .forEach((req) => {
        this.emit(BulkRequestEventEnum.REQUEST_FAILED, req)
      })
  }
}
