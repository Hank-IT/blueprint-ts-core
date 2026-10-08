import { FetchDriver } from './drivers/fetch/FetchDriver'
import { RequestSubscriptions } from './RequestSubscriptions'
import { RequestConcurrencyMode } from './RequestConcurrencyMode.enum'
import { StaleResponseException } from './exceptions/StaleResponseException'
import type { RequestDriverContract } from './contracts/RequestDriverContract'
import type { DriverConfigContract } from './contracts/DriverConfigContract'
import type { HeadersContract } from './contracts/HeadersContract'
import type { RequestLoaderFactoryContract } from './contracts/RequestLoaderFactoryContract'
import type { RequestConcurrencyOptions } from './types/RequestConcurrencyOptions'
import type { RequestEvents } from './RequestEvents.enum'
import type { RequestEventHandler, RequestListenerErrorHandler, RequestSnapshot } from './types/RequestLifecycle'

export interface RequestClientOptions {
  baseUrl?: string | undefined
  driver?: RequestDriverContract | undefined
  headers?: HeadersContract | undefined
  config?: DriverConfigContract | undefined
  loaderFactory?: RequestLoaderFactoryContract<unknown> | undefined
  onListenerError?: RequestListenerErrorHandler | undefined
}

let defaultClient: RequestClient | undefined

export class RequestClient {
  private subscriptions = new RequestSubscriptions()
  private readonly sequences = new Map<string, number>()
  private readonly inFlight = new Map<string, number>()
  private readonly replacements = new Map<string, AbortController>()
  private readonly controllers = new Set<AbortController>()
  private readonly cleanups = new Set<() => void>()
  private transportOverride: RequestDriverContract | undefined
  private disposed = false

  public constructor(private readonly options: RequestClientOptions = {}) {}

  public static getDefault(): RequestClient {
    if (defaultClient === undefined) throw new Error('Configure the default RequestClient before constructing requests.')
    return defaultClient
  }
  public static setDefault(client: RequestClient): void {
    defaultClient = client
  }
  public on<Event extends RequestEvents>(event: Event, handler: RequestEventHandler<Event>): () => void {
    return this.subscriptions.on(event, handler)
  }
  public snapshotSubscriptions(): RequestSubscriptions {
    return this.subscriptions.snapshot()
  }
  public getBaseUrl(): string | undefined {
    return this.options.baseUrl
  }
  public setBaseUrl(url: string): this {
    this.options.baseUrl = url
    return this
  }
  public getHeaders(): HeadersContract {
    return { ...this.options.headers }
  }
  public getConfig(): DriverConfigContract {
    return { ...this.options.config }
  }
  public getLoaderFactory(): RequestLoaderFactoryContract<unknown> | undefined {
    return this.options.loaderFactory
  }
  public setLoaderFactory(factory: RequestLoaderFactoryContract<unknown>): this {
    this.options.loaderFactory = factory
    return this
  }
  public setDriver(driver: RequestDriverContract): this {
    this.options.driver = driver
    return this
  }
  public getDriver(): RequestDriverContract {
    return this.options.driver ?? new FetchDriver()
  }
  public setTransportOverride(driver: RequestDriverContract | undefined): void {
    this.transportOverride = driver
  }
  public getTransportOverride(): RequestDriverContract | undefined {
    return this.transportOverride
  }
  public getActiveRequestCount(): number {
    return [...this.inFlight.values()].reduce((total, count) => total + count, 0)
  }

  public reportListenerError(error: unknown, event: RequestEvents, snapshot: RequestSnapshot): void {
    try {
      const result = (this.options.onListenerError ?? console.error)(error, event, snapshot)
      if (result !== undefined) Promise.resolve(result).catch((reportError: unknown) => console.error(reportError))
    } catch (reportError) {
      console.error(reportError)
    }
  }

  public fork(): RequestClient {
    const client = new RequestClient({ ...this.options, headers: this.getHeaders(), config: this.getConfig() })
    client.subscriptions = this.subscriptions.snapshot()
    return client
  }

  public onDispose(cleanup: () => void): () => void {
    if (this.disposed) throw new Error('Request client is disposed.')
    this.cleanups.add(cleanup)
    return () => {
      this.cleanups.delete(cleanup)
    }
  }

  public dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const controller of this.controllers) controller.abort()
    const errors: unknown[] = []
    for (const cleanup of [...this.cleanups].reverse()) {
      try {
        cleanup()
      } catch (error) {
        errors.push(error)
      }
    }
    this.cleanups.clear()
    if (errors.length === 1) throw errors[0]
    if (errors.length > 1) throw new AggregateError(errors, 'Request client verification failed.')
  }

  public begin(snapshot: RequestSnapshot, concurrency: RequestConcurrencyOptions | undefined, detached: boolean) {
    if (this.disposed) throw new Error('Request client is disposed.')
    const key = detached ? snapshot.sendId : (concurrency?.key ?? snapshot.requestId)
    const mode = detached ? RequestConcurrencyMode.ALLOW : (concurrency?.mode ?? RequestConcurrencyMode.ALLOW)
    const latest = mode === RequestConcurrencyMode.LATEST || mode === RequestConcurrencyMode.REPLACE_LATEST
    const replace = mode === RequestConcurrencyMode.REPLACE || mode === RequestConcurrencyMode.REPLACE_LATEST
    const sequence = (this.sequences.get(key) ?? 0) + 1
    this.sequences.set(key, sequence)
    this.inFlight.set(key, (this.inFlight.get(key) ?? 0) + 1)
    const controller = new AbortController()
    if (!detached) this.controllers.add(controller)
    if (replace) {
      this.replacements.get(key)?.abort()
      this.replacements.set(key, controller)
    }
    const isCurrent = () => !latest || this.sequences.get(key) === sequence
    let finished = false
    return {
      controller,
      isCurrent,
      assertCurrent: () => {
        if (!isCurrent()) throw new StaleResponseException()
        if (controller.signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
      },
      finish: () => {
        if (finished) return
        finished = true
        this.controllers.delete(controller)
        const count = (this.inFlight.get(key) ?? 1) - 1
        if (count > 0) this.inFlight.set(key, count)
        else {
          this.inFlight.delete(key)
          this.sequences.delete(key)
          this.replacements.delete(key)
        }
      }
    }
  }
}

/** A fresh client lifetime. Default scopes are nested; explicit clients can run independently. */
export function createRequestScope(options: { client?: RequestClient; makeDefault?: boolean } = {}): { client: RequestClient; dispose(): void } {
  const previous = defaultClient
  const client = options.client ?? previous?.fork() ?? new RequestClient()
  const makeDefault = options.makeDefault !== false
  if (makeDefault) defaultClient = client
  let disposed = false
  return {
    client,
    dispose: () => {
      if (disposed) return
      if (makeDefault && defaultClient !== client) throw new Error('Default request scopes must be disposed in reverse order.')
      disposed = true
      try {
        client.dispose()
      } finally {
        if (makeDefault) defaultClient = previous
      }
    }
  }
}
