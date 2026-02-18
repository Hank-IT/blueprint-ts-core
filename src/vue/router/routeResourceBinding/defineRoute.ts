import { markRaw, type Component } from 'vue'
import { type RouteRecordRaw } from 'vue-router'
import { type InjectConfig } from './types'

/**
 * Type-safe route definition helper that ties:
 * - component props type (Props)
 * - inject config types (must resolve Props[K])
 *
 * Usage:
 * export default defineRoute<{ product: ProductResource }>()({
 *   path: '/products/:productId',
 *   component: ProductShowPage,
 *   errorComponent: GenericErrorPage,
 *   loadingComponent: LoadingSpinner,
 *   inject: { product: { from: 'productId', resolve: ... } },
 * })
 */
export function defineRoute<Props extends Record<string, unknown>>() {
  return function <
    T extends RouteRecordRaw & {
      inject?: InjectConfig<Props>
      errorComponent?: Component
      loadingComponent?: Component
      lazy?: boolean
    }
  >(route: T): RouteRecordRaw {
    const originalProps = route.props

    if (route.errorComponent) {
      route.meta = route.meta ?? {}
      route.meta._errorComponent = markRaw(route.errorComponent)
      delete route.errorComponent
    }

    if (route.loadingComponent) {
      route.meta = route.meta ?? {}
      route.meta._loadingComponent = markRaw(route.loadingComponent)
      delete route.loadingComponent
    }

    if (route.lazy !== undefined) {
      route.meta = route.meta ?? {}
      route.meta._lazy = route.lazy
      delete route.lazy
    }

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
