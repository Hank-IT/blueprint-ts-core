import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { defineRoute } from '../../../../src/vue/router/routeResourceBinding/defineRoute'
import { RouteResourceRequestResolver } from '../../../../src/vue/router/routeResourceBinding/RouteResourceRequestResolver'
import { useRouteResource } from '../../../../src/vue/router/routeResourceBinding/useRouteResource'

const mockRoute = reactive({
  meta: {} as Record<string, unknown>,
})

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
}))

describe('Route resource helpers', () => {
  it('RouteResourceRequestResolver resolves data from request', async () => {
    const request = {
      send: vi.fn().mockResolvedValue({ getData: () => ({ id: 1 }) }),
    }

    const resolver = new RouteResourceRequestResolver(request)
    await expect(resolver.resolve()).resolves.toEqual({ id: 1 })
  })

  it('useRouteResource exposes loading, error, and refresh', async () => {
    const refreshMock = vi.fn().mockResolvedValue('ok')
    mockRoute.meta = {
      refresh: refreshMock,
      _injectionState: { product: { loading: true, error: new Error('fail') } },
    }

    const { isLoading, error, refresh } = useRouteResource('product')

    expect(isLoading.value).toBe(true)
    expect(error.value).toBeInstanceOf(Error)

    await refresh({ silent: true })
    expect(refreshMock).toHaveBeenCalledWith('product', { silent: true })
  })

  it('defineRoute moves meta config and merges injected props', () => {
    const ErrorComp = { name: 'ErrorComp' }
    const LoadingComp = { name: 'LoadingComp' }

    const route = defineRoute<{ product: string }>()({
      path: '/products/:id',
      component: { name: 'Page' },
      props: true,
      errorComponent: ErrorComp,
      loadingComponent: LoadingComp,
      lazy: true,
      meta: {},
    })

    expect((route.meta as Record<string, unknown>)._errorComponent).toBe(ErrorComp)
    expect((route.meta as Record<string, unknown>)._loadingComponent).toBe(LoadingComp)
    expect((route.meta as Record<string, unknown>)._lazy).toBe(true)
    expect((route as Record<string, unknown>).errorComponent).toBeUndefined()
    expect((route as Record<string, unknown>).loadingComponent).toBeUndefined()
    expect((route as Record<string, unknown>).lazy).toBeUndefined()

    const propsFn = route.props as (to: { params: Record<string, unknown>; meta: Record<string, unknown> }) => Record<string, unknown>
    const props = propsFn({
      params: { id: 5 },
      meta: { _injectedProps: { product: 'Widget' } },
    })

    expect(props).toEqual({ id: 5, product: 'Widget' })
  })
})
