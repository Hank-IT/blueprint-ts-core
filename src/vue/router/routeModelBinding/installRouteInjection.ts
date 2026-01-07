import { type Router } from 'vue-router'

type InjectRuntimeConfig = {
  from: string
  resolve: (param: string) => { resolve(): Promise<unknown> }
  getter: (payload: unknown) => unknown
}

/**
 * Installs the runtime part:
 * - resolves all route.inject entries before navigation completes
 * - stores results on to.meta._injectedProps
 * - ensures route props include injected results (so components receive them as props)
 *
 * Notes:
 * - This keeps router files clean: only an `inject` block per route.
 * - This is intentionally runtime-generic; type safety happens at route definition time.
 */
export function installRouteInjection(router: Router) {
  router.beforeResolve(async (to) => {
    console.log('[Route Injection] Resolving route injections...')

    const resolvedProps: Record<string, unknown> = {}

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

        const resolver = cfg.resolve(paramValue)

        let payload = await resolver.resolve()

        if (typeof cfg.getter === 'function') {
          payload = cfg.getter(payload)
        }

        resolvedProps[propName] = payload

        console.debug(
          `[Route Injection] Successfully resolved prop "${propName}" for route "${record.path}": ${JSON.stringify(resolvedProps[propName])}`
        )
      }
    }

    to.meta._injectedProps = resolvedProps
  })
}
