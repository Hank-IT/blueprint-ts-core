import { type Router } from 'vue-router'
import { reactive } from 'vue'

type InjectRuntimeConfig = {
  from: string
  resolve: (param: string) => { resolve(): Promise<unknown> }
  getter: (payload: unknown) => unknown
}

type CachedEntry = {
  paramValue: string
  payload: unknown
}

/**
 * Installs the runtime part:
 * - resolves all route.inject entries before navigation completes
 * - stores results on to.meta._injectedProps
 * - ensures route props include injected results (so components receive them as props)
 * - caches resolved resources so child routes inherit parent-resolved data
 *   without triggering redundant requests (as long as the param value is unchanged)
 *
 * Notes:
 * - This keeps router files clean: only an `inject` block per route.
 * - This is intentionally runtime-generic; type safety happens at route definition time.
 */
export function installRouteInjection(router: Router) {
  const cache: Record<string, CachedEntry> = {}

  router.beforeResolve(async (to) => {
    console.log('[Route Injection] Resolving route injections...')

    if (!to.meta._injectedProps) {
      to.meta._injectedProps = reactive({})
    }

    if (!to.meta._injectionState) {
      to.meta._injectionState = reactive({})
    }

    const resolvers: Record<string, (options?: { silent?: boolean }) => Promise<unknown>> = {}
    const activePropNames = new Set<string>()
    const pendingResolvers: Array<() => Promise<void>> = []

    // Iterate through all matched route records (from parent to child)
    for (const record of to.matched) {
      console.debug(`[Route Injection] Processing route "${record.path}"`)

      // Access the custom 'inject' property directly from the record
      const inject = record.meta.inject as Record<string, InjectRuntimeConfig> | undefined

      if (!inject) {
        console.debug(`[Route Injection] No injections found for route "${record.path}"`)

        continue
      }

      for (const [propName, cfg] of Object.entries(inject)) {
        const rawParam = to.params[cfg.from]

        if (rawParam === undefined || rawParam === null) {
          console.warn(`[Route Injection] Param "${cfg.from}" not found for prop "${propName}"`)

          continue
        }

        const paramValue = Array.isArray(rawParam) ? rawParam[0] : String(rawParam)

        if (paramValue === undefined || paramValue === null) {
          console.warn(`[Route Injection] Param value "${cfg.from}" not found for prop "${propName}"`)

          continue
        }

        activePropNames.add(propName)

        // Initialize state for this prop
        const state = to.meta._injectionState as Record<string, { loading: boolean; error: Error | null }>
        if (!state[propName]) {
          state[propName] = reactive({ loading: false, error: null })
        }

        // Define the refresh logic for this specific prop (always fetches fresh data)
        const resolveProp = async (options?: { silent?: boolean }) => {
          const propState = (to.meta._injectionState as Record<string, { loading: boolean; error: Error | null }>)[propName]!
          if (!options?.silent) {
            propState.loading = true
          }
          propState.error = null

          try {
            const resolver = cfg.resolve(paramValue)
            let payload = await resolver.resolve()
            if (typeof cfg.getter === 'function') {
              payload = cfg.getter(payload)
            }

            // Update cache
            cache[propName] = { paramValue, payload }

            // Updating the reactive object triggers the component re-render
            const injectedProps = to.meta._injectedProps as Record<string, unknown>
            injectedProps[propName] = payload
            return payload
          } catch (e) {
            propState.error = e instanceof Error ? e : new Error(String(e))
            throw e
          } finally {
            propState.loading = false
          }
        }

        resolvers[propName] = resolveProp

        // Reuse cached value if the param hasn't changed (e.g. navigating between child routes)
        const cached = cache[propName]
        if (cached && cached.paramValue === paramValue) {
          console.debug(`[Route Injection] Using cached value for prop "${propName}" (param "${cfg.from}" unchanged)`)
          const injectedPropsCache = to.meta._injectedProps as Record<string, unknown>
          injectedPropsCache[propName] = cached.payload

          continue
        }

        // Set loading immediately and queue resolver (non-blocking)
        const injectionState = to.meta._injectionState as Record<string, { loading: boolean; error: Error | null }>
        injectionState[propName]!.loading = true
        pendingResolvers.push(async () => {
          try {
            await resolveProp()
          } catch (e) {
            console.error(`[Route Injection] Failed to resolve prop "${propName}"`, e)
          }
        })

        console.debug(`[Route Injection] Queued resolution for prop "${propName}" for route "${record.path}"`)
      }
    }

    // Evict cache entries that are no longer part of the active route hierarchy
    for (const key of Object.keys(cache)) {
      if (!activePropNames.has(key)) {
        delete cache[key]
      }
    }

    // Attach the resolvers and a global refresh helper to the route meta
    to.meta['_injectedResolvers'] = resolvers
    to.meta['refresh'] = async (propName: string, options?: { silent?: boolean }) => {
      if (resolvers[propName]) {
        return await resolvers[propName](options)
      }

      console.warn(`[Route Injection] No resolver found for "${propName}"`)

      return undefined
    }

    // Fire pending resolvers without blocking navigation
    if (pendingResolvers.length > 0) {
      Promise.all(pendingResolvers.map((fn) => fn()))
    }
  })
}
