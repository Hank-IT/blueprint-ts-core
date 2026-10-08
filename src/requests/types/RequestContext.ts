export type ReadonlyContext<T> = T extends object ? { readonly [K in keyof T]: ReadonlyContext<T[K]> } : T

export interface RequestContextKey<T> {
  readonly id: symbol
  readonly snapshot: (value: T) => ReadonlyContext<T>
}

/** Context is data, separate from request bodies and transport configuration. */
export function snapshotContext<T>(value: T): ReadonlyContext<T> {
  if (typeof value === 'function') throw new TypeError('Request context cannot contain functions.')
  if (value === null || typeof value !== 'object') return value as ReadonlyContext<T>
  if (Array.isArray(value)) return Object.freeze(value.map(snapshotContext)) as ReadonlyContext<T>
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError('Request context must contain plain objects, arrays, and primitive values.')
  }
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, snapshotContext(child)]))) as ReadonlyContext<T>
}

export function createRequestContextKey<T>(description: string): RequestContextKey<T> {
  return Object.freeze({ id: Symbol(description), snapshot: snapshotContext<T> })
}

export class RequestContext {
  private readonly values: ReadonlyMap<symbol, unknown>

  public constructor() {
    this.values = new Map()
  }

  public with<T>(key: RequestContextKey<T>, value: T): RequestContext {
    const result = new RequestContext()
    const values = result.values as Map<symbol, unknown>
    for (const [id, existing] of this.values) values.set(id, existing)
    values.set(key.id, key.snapshot(value))
    return result
  }

  public merge(other: RequestContext): RequestContext {
    const result = new RequestContext()
    const values = result.values as Map<symbol, unknown>
    for (const [id, value] of this.values) values.set(id, value)
    for (const [id, value] of other.values) values.set(id, value)
    return result
  }

  public get<T>(key: RequestContextKey<T>): ReadonlyContext<T> | undefined {
    return this.values.get(key.id) as ReadonlyContext<T> | undefined
  }

  public require<T>(key: RequestContextKey<T>): ReadonlyContext<T> {
    const value = this.get(key)
    if (value === undefined) throw new Error(`Missing request context: ${key.id.description}`)
    return value
  }
}
