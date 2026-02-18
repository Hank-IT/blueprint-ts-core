import { computed, type ComputedRef } from 'vue'
import { useRoute } from 'vue-router'

type InjectionState = Record<string, { loading: boolean; error: Error | null }>

export function useRouteResource(propName: string) {
  const route = useRoute()

  const refresh = async (options?: { silent?: boolean }) => {
    return await route.meta.refresh?.(propName, options)
  }

  const isLoading: ComputedRef<boolean> = computed(() => {
    const state = route.meta._injectionState as InjectionState | undefined
    return state?.[propName]?.loading ?? false
  })

  const error: ComputedRef<Error | null> = computed(() => {
    const state = route.meta._injectionState as InjectionState | undefined
    return state?.[propName]?.error ?? null
  })

  return { refresh, isLoading, error }
}
