import { useRoute } from 'vue-router'

export function useRouteResource() {
  const route = useRoute()

  const refresh = async (propName: string) => {
    return await route.meta.refresh?.(propName)
  }

  // If emit is passed, we can wrap it or just provide a helper
  // to be used like: onRefresh('product', () => ...)
  // but the most direct way for you is:
  return { refresh }
}
