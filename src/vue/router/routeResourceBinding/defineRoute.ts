import { type RouteRecordRaw } from 'vue-router'
import { type InjectConfig } from './types'

/**
 * Type-safe route definition helper that ties:
 * - component props type (Props)
 * - inject config types (must resolve Props[K])
 *
 * Usage:
 * export default defineRoute<{ product: ProductResource }>()({ ... })
 */
export function defineRoute<Props extends Record<string, unknown>>() {
  return function <
    T extends RouteRecordRaw & {
      inject?: InjectConfig<Props>
    }
  >(route: T): RouteRecordRaw {
    const originalProps = route.props

    route.props = (to) => {
      const baseProps = typeof originalProps === 'function' ? originalProps(to) : originalProps === true ? to.params : (originalProps ?? {})

      return {
        ...(baseProps as Record<string, unknown>),
        ...((to.meta._injectedProps as Record<string, unknown>) ?? {})
      }
    }

    return route
  }
}
