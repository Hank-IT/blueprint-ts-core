import { computed, defineComponent, h, type Component as VueComponent, type VNode } from 'vue'
import { RouterView, useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'

type InjectionState = Record<string, { loading: boolean; error: Error | null }>

/**
 * Drop-in replacement for `<router-view>` that handles route resource
 * injection loading and error states.
 *
 * When any injected resource is loading → renders the route's `loadingComponent`.
 * When any injected resource has an error → renders the route's `errorComponent`
 *   (receives `error` and `refresh` as props).
 * Otherwise → passes `{ Component, route }` to the default scoped slot,
 *   just like `<RouterView>`.
 *
 * Error and loading components are defined in the route via `defineRoute`:
 *
 * ```ts
 * defineRoute<{ credential: CredentialResource }>()({
 *   path: '/credentials/:credentialId',
 *   component: CredentialShowPage,
 *   errorComponent: GenericErrorPage,
 *   loadingComponent: LoadingSpinner,
 *   inject: {
 *     credential: {
 *       from: 'credentialId',
 *       resolve: (id) => new RouteResourceRequestResolver(new CredentialShowRequest(id)),
 *     },
 *   },
 * })
 * ```
 *
 * Set `lazy: false` to render the target component immediately (without
 * waiting for resources). The component can then handle loading/error
 * states itself via `useRouteResource()`:
 *
 * ```ts
 * defineRoute<{ credential: CredentialResource }>()({
 *   path: '/credentials/:credentialId',
 *   component: CredentialShowPage,
 *   lazy: false,
 *   inject: { ... },
 * })
 * ```
 *
 * Usage in layout (supports the same v-slot pattern as RouterView):
 * ```vue
 * <RouteResourceBoundView v-slot="{ Component, route }">
 *   <component :is="Component" v-if="Component" :key="route.meta.usePathKey ? route.path : undefined" />
 *   <EmptyState v-else />
 * </RouteResourceBoundView>
 * ```
 *
 * Or without a slot (renders the matched component automatically):
 * ```vue
 * <RouteResourceBoundView />
 * ```
 */
export const RouteResourceBoundView = defineComponent({
  name: 'RouteResourceBoundView',

  setup(_, { slots }) {
    const route = useRoute()

    const injectionState = computed(() => {
      return route.meta._injectionState as InjectionState | undefined
    })

    const firstError = computed((): Error | null => {
      const state = injectionState.value
      if (!state) return null

      for (const key of Object.keys(state)) {
        const entry = state[key]
        if (entry?.error) return entry.error
      }

      return null
    })

    const anyLoading = computed((): boolean => {
      const state = injectionState.value
      if (!state) return false

      return Object.keys(state).some((key) => state[key]?.loading)
    })

    const refresh = async () => {
      const state = injectionState.value
      if (!state) return

      const erroredProps = Object.keys(state).filter((key) => state[key]?.error)

      await Promise.all(erroredProps.map((propName) => route.meta.refresh?.(propName)))
    }

    /**
     * Core render logic that decides which slot/component to show
     * given the resolved Component and route from RouterView.
     */
    function renderContent(Component: VueComponent | undefined, resolvedRoute: RouteLocationNormalizedLoaded): VNode | VNode[] | undefined {
      const isLazy = resolvedRoute.meta._lazy !== false

      if (isLazy) {
        if (firstError.value) {
          const errorComponent = resolvedRoute.meta._errorComponent

          if (errorComponent) {
            return h(errorComponent, { error: firstError.value, refresh })
          }

          return slots['error']?.({ error: firstError.value, refresh })
        }

        if (anyLoading.value) {
          const loadingComponent = resolvedRoute.meta._loadingComponent

          if (loadingComponent) {
            return h(loadingComponent)
          }

          return slots['loading']?.()
        }
      }

      if (slots['default']) {
        return slots['default']({ Component, route: resolvedRoute })
      }

      if (Component) {
        return h(Component)
      }

      return undefined
    }

    return () => {
      return h(RouterView, null, {
        default: ({ Component, route: resolvedRoute }: { Component: VueComponent | undefined; route: RouteLocationNormalizedLoaded }) => {
          return renderContent(Component, resolvedRoute)
        }
      })
    }
  }
})
