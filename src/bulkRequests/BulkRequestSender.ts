import { BulkRequestWrapper } from './BulkRequestWrapper'
import { BulkRequestEventEnum } from './BulkRequestEvent.enum'

export enum BulkRequestExecutionMode {
  PARALLEL = 'parallel',
  SEQUENTIAL = 'sequential'
}

export interface BulkRequestScheduling<Wrapper> {
  keys(request: Wrapper): readonly string[]
  beforeSend?(request: Wrapper): void | Promise<void>
  succeeded?(request: Wrapper): void | Promise<void>
  stopDependentsOnFailure?: boolean
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
  private scheduling:
    | BulkRequestScheduling<BulkRequestWrapper<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface>>
    | undefined
  private retryPolicy: ((error: unknown, attempt: number) => boolean) | undefined
  private sending = false
  private concurrencyLimit = Infinity
  protected abortController: AbortController | undefined = undefined

  public constructor(
    protected requests: BulkRequestWrapper<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface>[] = [],
    protected executionMode: BulkRequestExecutionMode = BulkRequestExecutionMode.PARALLEL,
    protected retryCount: number = 0
  ) {}

  public setRequests(requests: BulkRequestWrapper<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface>[] = []) {
    if (this.sending) throw new Error('Cannot replace requests while a batch is running.')
    this.requests = requests

    return this
  }

  public setExecutionMode(mode: BulkRequestExecutionMode): this {
    this.executionMode = mode

    return this
  }

  public setConcurrencyLimit(limit: number): this {
    if (limit !== Infinity && (!Number.isInteger(limit) || limit < 1)) throw new Error('Concurrency must be a positive integer or Infinity.')
    if (this.sending) throw new Error('Cannot change concurrency while a batch is running.')
    this.concurrencyLimit = limit
    return this
  }

  public setRetryCount(count: number): this {
    this.retryCount = count

    return this
  }

  public get isLoading(): boolean {
    return this.sending
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

  public setScheduling(
    scheduling: BulkRequestScheduling<BulkRequestWrapper<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface>>
  ): this {
    this.scheduling = scheduling
    return this
  }

  public setRetryPolicy(policy: (error: unknown, attempt: number) => boolean): this {
    this.retryPolicy = policy
    return this
  }

  public async send() {
    if (this.sending) throw new Error('This batch is already running.')
    this.sending = true
    this.abortController = new AbortController()
    try {
      if (this.executionMode === BulkRequestExecutionMode.PARALLEL) await this.sendParallel()
      else await this.sendSequential()
    } finally {
      this.sending = false
    }
    const succeeded = this.requests
      .filter((r) => r.getOutcome() === 'succeeded')
      .map((r) => r.getResponse())
      .filter((response): response is ResponseClass => response !== null)
    const failed = this.requests.filter((r) => r.getOutcome() === 'failed').map((r) => r.getError())
    const cancelled = this.requests.filter((r) => r.getOutcome() === 'cancelled').map((r) => r.getError())
    const successCount = this.requests.filter((r) => r.getOutcome() === 'succeeded').length
    return {
      getSuccessCount: () => successCount,
      getErrorCount: () => failed.length,
      getCancelledCount: () => cancelled.length,
      getSuccessfulResponses: () => [...succeeded],
      getFailedResponses: () => [...failed],
      getCancelledResponses: () => [...cancelled]
    }
  }

  protected async sendParallel(): Promise<void> {
    await this.sendScheduled(false)
  }
  protected async sendSequential(): Promise<void> {
    await this.sendScheduled(true)
  }

  private async sendScheduled(sequential: boolean): Promise<void> {
    let active = 0
    const waiting: Array<() => void> = []
    const acquire = async (): Promise<void> => {
      if (active < this.concurrencyLimit) active++
      else await new Promise<void>((resolve) => waiting.push(resolve))
    }
    const release = (): void => {
      const next = waiting.shift()
      if (next !== undefined) next()
      else active--
    }
    const pending = new Map<string, Promise<boolean>>()
    let previous: Promise<boolean> = Promise.resolve(true)
    const all: Promise<boolean>[] = []
    for (const request of this.requests) {
      const keys = [...new Set(this.scheduling?.keys(request) ?? [])]
      const dependencies = keys.flatMap((key) => (pending.has(key) ? [pending.get(key)!] : []))
      const sequentialDependency = sequential ? previous : Promise.resolve(true)
      const operation = Promise.all([sequentialDependency, ...dependencies]).then(async ([, ...outcomes]) => {
        await acquire()
        try {
          if (this.abortController?.signal.aborted || (this.scheduling?.stopDependentsOnFailure !== false && outcomes.includes(false))) {
            request.cancel()
          } else {
            try {
              await this.scheduling?.beforeSend?.(request)
              let attempt = 0
              do {
                await request.send(this.abortController?.signal)
                attempt++
              } while (request.getOutcome() === 'failed' && attempt <= this.retryCount && this.canRetry(request.getError(), attempt))
              if (request.getOutcome() === 'succeeded') await this.scheduling?.succeeded?.(request)
            } catch (error) {
              request.fail(error)
            }
          }
          const outcome = request.getOutcome()
          this.emit(
            outcome === 'succeeded'
              ? BulkRequestEventEnum.REQUEST_SUCCESSFUL
              : outcome === 'cancelled'
                ? BulkRequestEventEnum.REQUEST_CANCELLED
                : BulkRequestEventEnum.REQUEST_FAILED,
            request
          )
          return outcome === 'succeeded'
        } finally {
          release()
        }
      })
      keys.forEach((key) => pending.set(key, operation))
      previous = operation
      all.push(operation)
    }
    await Promise.all(all)
  }

  private canRetry(error: unknown, attempt: number): boolean {
    if (this.abortController?.signal.aborted) return false
    return this.retryPolicy?.(error, attempt) === true
  }
}
