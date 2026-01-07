import { debounce } from 'lodash-es'
import { type PersistenceDriver } from '../../service/persistenceDrivers'
import { NonPersistentDriver } from '../../service/persistenceDrivers'
import { computed, ref, type Ref, watch, reactive } from 'vue'

export interface StateOptions {
  persist?: boolean
  persistSuffix?: string
}

// Generic type for change handlers
type ChangeHandler<T> = (val: T, oldVal: T) => void

// Type for accessing nested properties with dot notation
type PathValue<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? T[K] extends Record<string, unknown>
        ? PathValue<T[K], Rest>
        : never
      : never
    : never

// Helper type to get all possible paths in an object
type PathsToStringProps<T> = T extends object ? { [K in keyof T]: K extends string ? K | `${K}.${PathsToStringProps<T[K]>}` : never }[keyof T] : never

// Union type of all possible dot-notation paths in T
type Path<T> = keyof T | PathsToStringProps<T>

export abstract class State<T extends object> {
  private readonly properties: { [K in keyof T]: Ref<T[K]> }
  private readonly _initial: T
  private readonly _persist: boolean
  private readonly _persistKey: string
  private _driver: PersistenceDriver
  private _stateProxy: T | null = null
  private _watchStopFunctions: Map<string, () => void> = new Map()
  private _resetHandlers: Map<string, (() => void)[]> = new Map()

  protected constructor(initial: T, options?: StateOptions) {
    this._initial = initial
    this._persist = !!options?.persist
    const className = this.constructor.name
    this._persistKey = className + (options?.persistSuffix ? `_${options.persistSuffix}` : '')
    this._driver = this.getPersistenceDriver()

    // --- Robust persistence load: invalidate if schema changed ---
    let loaded: T | null = null
    if (this._persist) {
      loaded = this._driver.get<T>(this._persistKey)
      if (loaded) {
        const initialKeys = Object.keys(initial).sort()
        const loadedKeys = Object.keys(loaded).sort()
        const sameKeys = initialKeys.length === loadedKeys.length && initialKeys.every((k, i) => k === loadedKeys[i])
        if (!sameKeys) {
          // Schema mismatch: remove stale/corrupt data, use fresh
          this._driver.remove(this._persistKey)
          loaded = null
        }
      }
    }

    // Use the valid loaded state, or fallback to initial
    const base = loaded ?? initial
    this.properties = {} as { [K in keyof T]: Ref<T[K]> }
    const keys = Object.keys(base) as Array<keyof T>

    for (const k of keys) {
      // Use Vue's reactive for objects and arrays
      let value = (base as T)[k]
      if (typeof value === 'object' && value !== null) {
        value = reactive(this.deepClone(value)) as T[typeof k]
      }

      const _ref = ref(value) as Ref<T[typeof k]>

      this.properties[k] = computed({
        get: () => _ref.value,
        set: (val) => {
          // Make objects and arrays reactive
          if (typeof val === 'object' && val !== null) {
            _ref.value = reactive(this.deepClone(val)) as T[typeof k]
          } else {
            _ref.value = val
          }

          if (this._persist) {
            this._driver.set(this._persistKey, this.export())
          }
        }
      }) as Ref<T[typeof k]>
    }
  }

  /**
   * Safe deep clone that preserves types
   */
  private deepClone<V>(value: V): V {
    if (value === null || value === undefined) return value
    if (typeof value !== 'object') return value

    return JSON.parse(JSON.stringify(value)) as V
  }

  /**
   * Get a proxy to the state that allows direct property access and setting
   * without using .value
   */
  public get state(): T {
    if (!this._stateProxy) {
      this._stateProxy = new Proxy({} as T, {
        get: (_, prop: string | symbol) => {
          if (typeof prop === 'symbol' || prop === 'toJSON') {
            return undefined
          }

          const key = prop as keyof T
          if (key in this.properties) {
            return this.properties[key].value
          }

          return undefined
        },
        set: (_, prop: string | symbol, value) => {
          if (typeof prop === 'symbol') {
            return false
          }

          const key = prop as keyof T
          if (key in this.properties) {
            this.properties[key].value = value
          }

          return true
        }
      })
    }

    return this._stateProxy
  }

  /**
   * Add a subscription to specific properties or nested properties
   * @param paths Path(s) to the property. Can be:
   *              - A single path (top-level key or nested with dot notation)
   *              - An array of paths to watch (triggers when any changes)
   * @param handler Function to call when the property changes
   * @param options Optional configuration for debounce and executeOnReset
   * @returns A function to remove the subscription
   */
  public subscribe<P extends Path<T>>(
    paths: P,
    handler: ChangeHandler<PathValue<T, P & string>>,
    options?: { debounce?: number; executeOnReset?: boolean }
  ): () => void
  public subscribe<P extends Path<T>>(
    paths: P[],
    handler: (changedPath: P, state: T) => void,
    options?: { debounce?: number; executeOnReset?: boolean }
  ): () => void
  public subscribe<P extends Path<T>>(
    paths: P | P[],
    handler: ChangeHandler<PathValue<T, P & string>> | ((changedPath: P, state: T) => void),
    options?: { debounce?: number; executeOnReset?: boolean }
  ): () => void {
    // Keep track of all watchers for cleanup
    const stopFunctions: (() => void)[] = []
    const resetHandlers: (() => void)[] = []

    // If paths is an array, register handlers for each path
    if (Array.isArray(paths)) {
      for (const path of paths) {
        // For arrays, we expect the handler to have the signature (changedPath, state) => void
        const pathHandler = () => {
          ;(handler as (changedPath: P, state: T) => void)(path, this.export())
        }

        // Store reset handler if needed
        if (options?.executeOnReset) {
          resetHandlers.push(pathHandler)
        }

        // Register handler for this individual path
        const stop = this.setupWatcher(path as string, pathHandler, options)
        stopFunctions.push(stop)
      }
    } else {
      const pathHandler = handler as ChangeHandler<unknown>

      // Store reset handler if needed
      if (options?.executeOnReset) {
        resetHandlers.push(() => pathHandler(undefined, undefined))
      }

      // For single paths, register directly with the provided handler
      const stop = this.setupWatcher(paths as string, pathHandler, options)
      stopFunctions.push(stop)
    }

    // Store reset handlers for later execution
    if (resetHandlers.length > 0) {
      const resetId = Math.random().toString(36)
      this._resetHandlers.set(resetId, resetHandlers)

      stopFunctions.push(() => {
        this._resetHandlers.delete(resetId)
      })
    }

    // Return a function that stops all watchers
    return () => stopFunctions.forEach((stop) => stop())
  }

  /**
   * Internal method to set up a watcher for a specific path
   */
  private setupWatcher(
    path: string,
    handler: (newVal?: unknown, oldVal?: unknown) => void,
    options?: { debounce?: number; executeOnReset?: boolean }
  ): () => void {
    const pathParts = path.split('.')
    const debouncedHandler = options?.debounce && options.debounce > 0 ? debounce(handler, options.debounce) : undefined

    const effectiveHandler = debouncedHandler || handler

    // For top-level properties
    if (pathParts.length === 1 && path in this.properties) {
      const key = path as keyof T

      // Set up watcher for this property
      const stopWatch = watch(
        () => this.properties[key].value,
        (newVal, oldVal) => {
          if (!this.isEqual(newVal, oldVal)) {
            effectiveHandler(newVal, oldVal)
          }
        },
        { deep: true }
      )

      // Save stop function for cleanup
      const watchId = `prop:${String(key)}`
      this._watchStopFunctions.set(watchId, stopWatch)

      return () => {
        if (this._watchStopFunctions.has(watchId)) {
          this._watchStopFunctions.get(watchId)!()
          this._watchStopFunctions.delete(watchId)
        }
      }
    }

    // For nested properties
    const topLevelKey = pathParts[0] as keyof T

    if (topLevelKey in this.properties) {
      // Create a nested property getter
      const getter = () => {
        let obj = this.properties[topLevelKey].value

        for (let i = 1; i < pathParts.length; i++) {
          if (!obj || typeof obj !== 'object') return undefined
          // @ts-expect-error: obj is guaranteed to be an object at this point
          obj = (obj as any)[pathParts[i]]
        }

        return obj
      }

      // Set up watcher for this nested property
      const stopWatch = watch(
        getter,
        (newVal, oldVal) => {
          if (!this.isEqual(newVal, oldVal)) {
            effectiveHandler(newVal, oldVal)
          }
        },
        { deep: true }
      )

      // Save stop function for cleanup
      const watchId = `nested:${String(path)}`
      this._watchStopFunctions.set(watchId, stopWatch)

      return () => {
        if (this._watchStopFunctions.has(watchId)) {
          this._watchStopFunctions.get(watchId)!()
          this._watchStopFunctions.delete(watchId)
        }
      }
    }

    // If path doesn't exist, return a no-op
    return () => {}
  }

  /**
   * Simple deep equality check
   */
  private isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true

    if (a === null || b === null) return false
    if (a === undefined || b === undefined) return false

    if (typeof a !== typeof b) return false

    if (typeof a === 'object' && typeof b === 'object') {
      const aArray = Array.isArray(a)
      const bArray = Array.isArray(b)

      if (aArray !== bArray) return false

      if (aArray && bArray) {
        const arrayA = a as unknown[]
        const arrayB = b as unknown[]
        if (arrayA.length !== arrayB.length) return false
        return arrayA.every((val, i) => this.isEqual(val, arrayB[i]))
      }

      const objA = a as Record<string, unknown>
      const objB = b as Record<string, unknown>

      const keysA = Object.keys(objA).sort()
      const keysB = Object.keys(objB).sort()

      if (keysA.length !== keysB.length) return false
      if (!keysA.every((k, i) => k === keysB[i])) return false

      return keysA.every((k) => this.isEqual(objA[k], objB[k]))
    }

    return false
  }

  protected getPersistenceDriver(): PersistenceDriver {
    return new NonPersistentDriver()
  }

  public export(): T {
    const out = {} as T
    for (const k in this.properties) {
      const key = k as keyof T
      out[key] = this.deepClone(this.properties[key].value)
    }
    return out
  }

  public import(data: Partial<T>): void {
    for (const k in data) {
      if (k in this.properties) {
        const key = k as keyof T
        this.properties[key].value = data[key] as T[typeof key]
      }
    }
    if (this._persist) {
      this._driver.set(this._persistKey, this.export())
    }
  }

  public reset(): void {
    this.import(this._initial)

    // Execute reset handlers
    for (const handlers of this._resetHandlers.values()) {
      for (const handler of handlers) {
        handler()
      }
    }
  }

  public get persistKey(): string {
    return this._persistKey
  }

  /**
   * Clean up all watchers when the state is no longer needed
   */
  public destroy(): void {
    // Stop all watchers
    for (const stopFn of this._watchStopFunctions.values()) {
      stopFn()
    }
    this._watchStopFunctions.clear()
    this._resetHandlers.clear()

    // Remove reference to proxy
    this._stateProxy = null
  }
}
