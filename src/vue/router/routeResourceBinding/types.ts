import { type RouteLocationNormalized } from 'vue-router'

/**
 * Generic resolver interface.
 */
export interface Resolver<T> {
  resolve(): Promise<T>
}

/**
 * A minimal "request" contract that matches your request classes:
 * new ProductShowRequest(id).send() -> { getData(): T }
 */
export interface DataRequest<T> {
  send(): Promise<{ getData(): T }>
}

/**
 * Inject config that is type-safe against component props.
 *
 * Props[K] is the required resolved type for prop K.
 */
export type InjectConfig<Props extends Record<string, unknown>> = {
  [K in keyof Props]?: {
    /**
     * Route param name, e.g. "productId"
     */
    from: keyof RouteLocationNormalized['params'] | string

    /**
     * Create a resolver from the param value.
     * Param value is treated as string (most common in routes).
     */
    resolve: (param: string) => Resolver<Props[K]>
  }
}

/**
 * Extended route meta to store injected props at runtime.
 */
declare module 'vue-router' {
  interface RouteMeta {
    _injectedProps?: Record<string, any>
    _injectedResolvers?: Record<string, () => Promise<any>>
    refresh?: (propName: string) => Promise<any>
    inject?: Record<string, unknown>
  }
}
