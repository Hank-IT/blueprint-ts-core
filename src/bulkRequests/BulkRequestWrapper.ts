import { type BaseRequestContract } from '../requests'

export type BulkRequestOutcome = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export class BulkRequestWrapper<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface extends object> {
  protected response: ResponseClass | null = null
  protected error: unknown | null = null
  private outcome: BulkRequestOutcome = 'pending'
  protected sent: boolean = false

  public constructor(protected request: BaseRequestContract<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface>) {}

  public async send(signal?: AbortSignal): Promise<void> {
    this.error = null
    this.response = null
    this.sent = false
    if (signal?.aborted) {
      this.cancel()
      return
    }
    this.outcome = 'running'
    this.sent = true
    try {
      if (signal !== undefined) this.request.setAbortSignal(signal)
      this.response = await this.request.send()
      if (signal?.aborted) {
        this.cancel()
        return
      }
      this.outcome = 'succeeded'
    } catch (error) {
      this.error = error
      this.outcome = signal?.aborted || (error instanceof Error && error.name === 'AbortError') ? 'cancelled' : 'failed'
    }
  }

  public getOutcome(): BulkRequestOutcome {
    return this.outcome
  }

  public cancel(reason: unknown = new DOMException('The operation was aborted.', 'AbortError')): void {
    this.response = null
    this.error = reason
    this.outcome = 'cancelled'
  }

  public fail(error: unknown): void {
    this.response = null
    this.error = error
    this.outcome = 'failed'
  }

  public isLoading(): RequestLoaderLoadingType {
    return this.request.isLoading()
  }

  public getResponse(): ResponseClass | null {
    return this.response
  }

  public getError(): unknown | null {
    return this.error
  }

  public getRequest(): BaseRequestContract<RequestLoaderLoadingType, RequestBodyInterface, ResponseClass, RequestParamsInterface> {
    return this.request
  }

  public hasError(): boolean {
    return this.error !== null
  }

  public wasSent(): boolean {
    return this.sent
  }
}
