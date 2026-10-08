import { RequestEvents } from './RequestEvents.enum'
import type { RequestEventArguments, RequestEventHandler, RequestListenerErrorHandler, RequestSnapshot } from './types/RequestLifecycle'

/** Typed subscriptions shared by clients and individual requests. */
export class RequestSubscriptions {
  private readonly handlers = new Map<RequestEvents, Map<symbol, unknown>>()

  public on<Event extends RequestEvents>(event: Event, handler: RequestEventHandler<Event>): () => void {
    const entries = this.handlers.get(event) ?? new Map<symbol, unknown>()
    const id = Symbol(event)
    entries.set(id, handler)
    this.handlers.set(event, entries)
    return () => {
      entries.delete(id)
    }
  }

  public snapshot(): RequestSubscriptions {
    const result = new RequestSubscriptions()
    for (const [event, entries] of this.handlers) result.handlers.set(event, new Map(entries))
    return result
  }

  public append(other: RequestSubscriptions): void {
    for (const [event, entries] of other.handlers) {
      for (const handler of entries.values()) this.on(event, handler as RequestEventHandler<typeof event>)
    }
  }

  public process<Event extends RequestEvents>(
    event: Event,
    args: RequestEventArguments[Event],
    assertCurrent: () => void
  ): false | void | Promise<false | void> {
    const handlers = [...(this.handlers.get(event)?.values() ?? [])] as RequestEventHandler<Event>[]
    const next = (start: number): false | void | Promise<false | void> => {
      for (let index = start; index < handlers.length; index++) {
        const result = handlers[index]!(...args)
        if (result !== undefined && result !== true && result !== false)
          return Promise.resolve(result).then((value) => {
            assertCurrent()
            if (event === RequestEvents.RESPONSE_ERROR && value === false) return false
            return next(index + 1)
          })
        assertCurrent()
        if (event === RequestEvents.RESPONSE_ERROR && result === false) return false
      }
    }
    return next(0)
  }

  public notify<Event extends RequestEvents>(
    event: Event,
    args: RequestEventArguments[Event],
    snapshot: RequestSnapshot,
    report: RequestListenerErrorHandler
  ): void {
    for (const handler of (this.handlers.get(event)?.values() ?? []) as Iterable<RequestEventHandler<Event>>) {
      try {
        const result = handler(...args)
        if (result !== undefined) void Promise.resolve(result).catch((error) => report(error, event, snapshot))
      } catch (error) {
        report(error, event, snapshot)
      }
    }
  }
}
