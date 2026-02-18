import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installRouteInjection } from '../../../../src/vue/router/routeResourceBinding/installRouteInjection'

/**
 * Flush all pending microtasks / promises.
 */
function flushPromises() {
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}

/**
 * Minimal stub for vue-router's Router – we only need `beforeResolve`.
 */
function createMockRouter() {
  const guards: Array<(to: any) => Promise<void>> = []

  return {
    beforeResolve(guard: (to: any) => Promise<void>) {
      guards.push(guard)
    },
    async simulateNavigation(to: any) {
      for (const guard of guards) {
        await guard(to)
      }
    }
  }
}

function createRoute(params: Record<string, string>, matched: any[]) {
  return {
    params,
    matched,
    meta: {} as Record<string, any>
  }
}

describe('installRouteInjection', () => {
  let mockRouter: ReturnType<typeof createMockRouter>

  beforeEach(() => {
    mockRouter = createMockRouter()
  })

  it('resolves injected props and stores them in _injectedProps', async () => {
    installRouteInjection(mockRouter as any)

    const resolveFn = vi.fn().mockResolvedValue('resolved-invoice')

    const to = createRoute({ invoiceId: '123' }, [
      {
        path: ':invoiceId',
        meta: {
          inject: {
            invoice: {
              from: 'invoiceId',
              resolve: () => ({ resolve: resolveFn })
            }
          }
        }
      }
    ])

    await mockRouter.simulateNavigation(to)
    await flushPromises()

    expect(resolveFn).toHaveBeenCalledTimes(1)
    expect(to.meta._injectedProps).toEqual({ invoice: 'resolved-invoice' })
  })

  it('reuses cached value when navigating to a child route with the same param', async () => {
    installRouteInjection(mockRouter as any)

    const resolveFn = vi.fn().mockResolvedValue('resolved-invoice')
    const parentRecord = {
      path: ':invoiceId',
      meta: {
        inject: {
          invoice: {
            from: 'invoiceId',
            resolve: () => ({ resolve: resolveFn })
          }
        }
      }
    }

    // First navigation: parent route
    const to1 = createRoute({ invoiceId: '123' }, [parentRecord])
    await mockRouter.simulateNavigation(to1)
    await flushPromises()

    expect(resolveFn).toHaveBeenCalledTimes(1)
    expect(to1.meta._injectedProps).toEqual({ invoice: 'resolved-invoice' })

    // Second navigation: parent + child route, same invoiceId
    const to2 = createRoute({ invoiceId: '123' }, [
      parentRecord,
      { path: 'details', meta: {} }
    ])
    await mockRouter.simulateNavigation(to2)
    await flushPromises()

    // resolve should NOT be called again – cached value reused
    expect(resolveFn).toHaveBeenCalledTimes(1)
    expect(to2.meta._injectedProps).toEqual({ invoice: 'resolved-invoice' })
  })

  it('re-resolves when param value changes', async () => {
    installRouteInjection(mockRouter as any)

    const resolveFn = vi.fn()
      .mockResolvedValueOnce('invoice-A')
      .mockResolvedValueOnce('invoice-B')

    const makeParent = () => ({
      path: ':invoiceId',
      meta: {
        inject: {
          invoice: {
            from: 'invoiceId',
            resolve: () => ({ resolve: resolveFn })
          }
        }
      }
    })

    // Navigate with invoiceId=1
    const to1 = createRoute({ invoiceId: '1' }, [makeParent()])
    await mockRouter.simulateNavigation(to1)
    await flushPromises()

    expect(resolveFn).toHaveBeenCalledTimes(1)
    expect(to1.meta._injectedProps).toEqual({ invoice: 'invoice-A' })

    // Navigate with invoiceId=2 – must re-resolve
    const to2 = createRoute({ invoiceId: '2' }, [makeParent()])
    await mockRouter.simulateNavigation(to2)
    await flushPromises()

    expect(resolveFn).toHaveBeenCalledTimes(2)
    expect(to2.meta._injectedProps).toEqual({ invoice: 'invoice-B' })
  })

  it('refresh() bypasses cache and fetches fresh data', async () => {
    installRouteInjection(mockRouter as any)

    const resolveFn = vi.fn()
      .mockResolvedValueOnce('old-data')
      .mockResolvedValueOnce('fresh-data')

    const to = createRoute({ invoiceId: '123' }, [
      {
        path: ':invoiceId',
        meta: {
          inject: {
            invoice: {
              from: 'invoiceId',
              resolve: () => ({ resolve: resolveFn })
            }
          }
        }
      }
    ])

    await mockRouter.simulateNavigation(to)
    await flushPromises()
    expect(to.meta._injectedProps).toEqual({ invoice: 'old-data' })

    // Manually refresh
    await to.meta.refresh!('invoice')
    expect(resolveFn).toHaveBeenCalledTimes(2)
    expect(to.meta._injectedProps).toEqual({ invoice: 'fresh-data' })
  })

  it('evicts cache entries when navigating away from a route', async () => {
    installRouteInjection(mockRouter as any)

    const invoiceResolve = vi.fn().mockResolvedValue('invoice-data')
    const productResolve = vi.fn().mockResolvedValue('product-data')

    // Navigate to invoice route
    const to1 = createRoute({ invoiceId: '1' }, [
      {
        path: ':invoiceId',
        meta: {
          inject: {
            invoice: {
              from: 'invoiceId',
              resolve: () => ({ resolve: invoiceResolve })
            }
          }
        }
      }
    ])
    await mockRouter.simulateNavigation(to1)
    await flushPromises()
    expect(invoiceResolve).toHaveBeenCalledTimes(1)

    // Navigate to a completely different route (product)
    const to2 = createRoute({ productId: '5' }, [
      {
        path: ':productId',
        meta: {
          inject: {
            product: {
              from: 'productId',
              resolve: () => ({ resolve: productResolve })
            }
          }
        }
      }
    ])
    await mockRouter.simulateNavigation(to2)
    await flushPromises()

    // Now navigate back to invoice with the same id – should re-resolve (cache was evicted)
    const to3 = createRoute({ invoiceId: '1' }, [
      {
        path: ':invoiceId',
        meta: {
          inject: {
            invoice: {
              from: 'invoiceId',
              resolve: () => ({ resolve: invoiceResolve })
            }
          }
        }
      }
    ])
    await mockRouter.simulateNavigation(to3)
    await flushPromises()
    expect(invoiceResolve).toHaveBeenCalledTimes(2)
  })

  it('child routes inherit parent injected props without re-resolving across multiple children', async () => {
    installRouteInjection(mockRouter as any)

    const resolveFn = vi.fn().mockResolvedValue('invoice-data')
    const parentRecord = {
      path: ':invoiceId',
      meta: {
        inject: {
          invoice: {
            from: 'invoiceId',
            resolve: () => ({ resolve: resolveFn })
          }
        }
      }
    }

    // Navigate to parent
    await mockRouter.simulateNavigation(createRoute({ invoiceId: '42' }, [parentRecord]))
    await flushPromises()
    expect(resolveFn).toHaveBeenCalledTimes(1)

    // Navigate to child A
    const toChildA = createRoute({ invoiceId: '42' }, [parentRecord, { path: 'edit', meta: {} }])
    await mockRouter.simulateNavigation(toChildA)
    await flushPromises()
    expect(resolveFn).toHaveBeenCalledTimes(1)
    expect(toChildA.meta._injectedProps).toEqual({ invoice: 'invoice-data' })

    // Navigate to child B
    const toChildB = createRoute({ invoiceId: '42' }, [parentRecord, { path: 'payments', meta: {} }])
    await mockRouter.simulateNavigation(toChildB)
    await flushPromises()
    expect(resolveFn).toHaveBeenCalledTimes(1)
    expect(toChildB.meta._injectedProps).toEqual({ invoice: 'invoice-data' })
  })

  it('sets loading state to true while resolving and false after', async () => {
    installRouteInjection(mockRouter as any)

    let resolvePromise: (value: string) => void
    const resolveFn = vi.fn().mockImplementation(() => {
      return new Promise<string>((resolve) => {
        resolvePromise = resolve
      })
    })

    const to = createRoute({ invoiceId: '123' }, [
      {
        path: ':invoiceId',
        meta: {
          inject: {
            invoice: {
              from: 'invoiceId',
              resolve: () => ({ resolve: resolveFn })
            }
          }
        }
      }
    ])

    await mockRouter.simulateNavigation(to)

    // Loading should be true while the resolver is pending
    const state = to.meta._injectionState as Record<string, { loading: boolean; error: Error | null }>
    expect(state.invoice.loading).toBe(true)
    expect(state.invoice.error).toBeNull()

    // Resolve the promise
    resolvePromise!('resolved-invoice')
    await flushPromises()

    // Loading should be false after resolution
    expect(state.invoice.loading).toBe(false)
    expect(state.invoice.error).toBeNull()
    expect(to.meta._injectedProps).toEqual({ invoice: 'resolved-invoice' })
  })

  it('sets error state when resolver fails', async () => {
    installRouteInjection(mockRouter as any)

    const resolveFn = vi.fn().mockRejectedValue(new Error('Network error'))

    const to = createRoute({ invoiceId: '123' }, [
      {
        path: ':invoiceId',
        meta: {
          inject: {
            invoice: {
              from: 'invoiceId',
              resolve: () => ({ resolve: resolveFn })
            }
          }
        }
      }
    ])

    await mockRouter.simulateNavigation(to)
    await flushPromises()

    const state = to.meta._injectionState as Record<string, { loading: boolean; error: Error | null }>
    expect(state.invoice.loading).toBe(false)
    expect(state.invoice.error).toBeInstanceOf(Error)
    expect(state.invoice.error!.message).toBe('Network error')
  })

  it('navigation is non-blocking (guard returns before resolvers complete)', async () => {
    installRouteInjection(mockRouter as any)

    let resolvePromise: (value: string) => void
    const resolveFn = vi.fn().mockImplementation(() => {
      return new Promise<string>((resolve) => {
        resolvePromise = resolve
      })
    })

    const to = createRoute({ invoiceId: '123' }, [
      {
        path: ':invoiceId',
        meta: {
          inject: {
            invoice: {
              from: 'invoiceId',
              resolve: () => ({ resolve: resolveFn })
            }
          }
        }
      }
    ])

    // simulateNavigation should return even though the resolver hasn't completed
    await mockRouter.simulateNavigation(to)

    // Props should NOT be set yet (resolver still pending)
    expect((to.meta._injectedProps as any).invoice).toBeUndefined()

    // Now resolve
    resolvePromise!('resolved-invoice')
    await flushPromises()

    expect(to.meta._injectedProps).toEqual({ invoice: 'resolved-invoice' })
  })

  it('refresh() with silent option does not set loading state', async () => {
    installRouteInjection(mockRouter as any)

    const resolveFn = vi.fn()
      .mockResolvedValueOnce('old-data')
      .mockResolvedValueOnce('fresh-data')

    const to = createRoute({ invoiceId: '123' }, [
      {
        path: ':invoiceId',
        meta: {
          inject: {
            invoice: {
              from: 'invoiceId',
              resolve: () => ({ resolve: resolveFn })
            }
          }
        }
      }
    ])

    await mockRouter.simulateNavigation(to)
    await flushPromises()
    expect(to.meta._injectedProps).toEqual({ invoice: 'old-data' })

    const state = to.meta._injectionState as Record<string, { loading: boolean; error: Error | null }>

    // Track loading state changes during silent refresh
    let loadingWasTrue = false
    const checkLoading = setInterval(() => {
      if (state.invoice.loading) loadingWasTrue = true
    }, 0)

    await to.meta.refresh!('invoice', { silent: true })

    clearInterval(checkLoading)
    expect(loadingWasTrue).toBe(false)
    expect(state.invoice.loading).toBe(false)
    expect(to.meta._injectedProps).toEqual({ invoice: 'fresh-data' })
  })

  it('refresh() resets loading and error state', async () => {
    installRouteInjection(mockRouter as any)

    const resolveFn = vi.fn()
      .mockRejectedValueOnce(new Error('First fail'))
      .mockResolvedValueOnce('success-data')

    const to = createRoute({ invoiceId: '123' }, [
      {
        path: ':invoiceId',
        meta: {
          inject: {
            invoice: {
              from: 'invoiceId',
              resolve: () => ({ resolve: resolveFn })
            }
          }
        }
      }
    ])

    await mockRouter.simulateNavigation(to)
    await flushPromises()

    const state = to.meta._injectionState as Record<string, { loading: boolean; error: Error | null }>
    expect(state.invoice.error).toBeInstanceOf(Error)

    // Refresh should clear the error and resolve successfully
    await to.meta.refresh!('invoice')
    expect(state.invoice.loading).toBe(false)
    expect(state.invoice.error).toBeNull()
    expect(to.meta._injectedProps).toEqual({ invoice: 'success-data' })
  })
})
