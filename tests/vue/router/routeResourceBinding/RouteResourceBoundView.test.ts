import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, markRaw, reactive, type VNode } from 'vue'
import { RouteResourceBoundView } from '../../../../src/vue/router/routeResourceBinding/RouteResourceBoundView'

/**
 * We mock vue-router's useRoute and RouterView.
 *
 * Since vi.mock is hoisted above all other code, the factory must be
 * self-contained — it cannot reference variables declared outside.
 * We import vue inside the factory to build the mock RouterView.
 *
 * After the mock, we grab a reference to the mocked RouterView so
 * our renderComponent helper can identify it when resolving VNodes.
 */
const mockRoute = reactive({
  meta: {} as Record<string, unknown>,
})

vi.mock('vue-router', async () => {
  const { defineComponent: dc, h: hFn } = await import('vue')

  const MockRouterViewInner = dc({
    name: 'MockRouterView',
    setup(_: unknown, { slots }: { slots: Record<string, (...args: unknown[]) => unknown> }) {
      return () => {
        if (slots['default']) {
          return slots['default']({ Component: null, route: null })
        }

        return hFn('div', 'RouterView-fallback')
      }
    },
  })

  return {
    useRoute: () => mockRoute,
    RouterView: MockRouterViewInner,
  }
})

// Import the mocked RouterView so we can identify it in VNode trees
const { RouterView: MockRouterView } = await import('vue-router')

const MockPageComponent = markRaw(
  defineComponent({ render: () => h('div', 'PageComponent') }),
)

type SlotFn = (...args: unknown[]) => VNode | VNode[] | undefined

/**
 * Calls setup() on RouteResourceBoundView and returns a render()
 * helper that also resolves the inner RouterView slot so we get
 * the *actual* content the component would display.
 */
function renderComponent(slots: Record<string, SlotFn> = {}) {
  const renderFn = (RouteResourceBoundView as unknown as {
    setup: (props: Record<string, never>, ctx: { slots: Record<string, SlotFn> }) => () => VNode
  }).setup({} as Record<string, never>, { slots })

  return {
    /**
     * Invoke the component's render function and, if the result is
     * h(RouterView, …, { default: fn }), resolve the RouterView
     * slot so we get the content that would actually be displayed.
     */
    render(): VNode | VNode[] | undefined {
      const vnode = renderFn()

      // The component returns h(RouterView, null, { default: slotFn }).
      // `vnode.children` holds the slot object when slots are passed
      // to h() as the third argument.
      if (vnode.type === MockRouterView && vnode.children) {
        const children = vnode.children as Record<string, SlotFn>
        if (typeof children['default'] === 'function') {
          return children['default']({ Component: MockPageComponent, route: mockRoute })
        }
      }

      return vnode
    },
  }
}

function initRouteMeta(propName: string, state: { loading: boolean; error: Error | null }) {
  mockRoute.meta._injectionState = reactive({
    [propName]: reactive({ ...state }),
  })
  mockRoute.meta._injectedProps = reactive({})
}

describe('RouteResourceBoundView', () => {
  beforeEach(() => {
    mockRoute.meta = {}
  })

  it('passes { Component, route } to the default scoped slot when resource is loaded', () => {
    initRouteMeta('credential', { loading: false, error: null })

    let receivedComponent: unknown = null
    let receivedRoute: unknown = null

    const { render } = renderComponent({
      default: ({ Component, route }: { Component: unknown; route: unknown }) => {
        receivedComponent = Component
        receivedRoute = route

        return h('div', 'Page Content')
      },
      loading: () => h('div', 'Loading...'),
      error: () => h('div', 'Error!'),
    })

    render()
    expect(receivedComponent).toBe(MockPageComponent)
    expect(receivedRoute).toBe(mockRoute)
  })

  it('renders the loading slot while resource is loading', () => {
    initRouteMeta('credential', { loading: true, error: null })

    let loadingRendered = false

    const { render } = renderComponent({
      default: () => h('div', 'Page Content'),
      loading: () => {
        loadingRendered = true

        return h('div', 'Loading...')
      },
      error: () => h('div', 'Error!'),
    })

    render()
    expect(loadingRendered).toBe(true)
  })

  it('renders the error slot with error and refresh when resource has an error', () => {
    const testError = new Error('Network failure')
    initRouteMeta('credential', { loading: false, error: testError })

    const refreshMock = vi.fn()
    mockRoute.meta.refresh = refreshMock

    let receivedError: Error | null = null
    let receivedRefresh: (() => Promise<unknown>) | null = null

    const { render } = renderComponent({
      default: () => h('div', 'Page Content'),
      loading: () => h('div', 'Loading...'),
      error: ({ error, refresh }: { error: Error; refresh: () => Promise<unknown> }) => {
        receivedError = error
        receivedRefresh = refresh

        return h('div', `Error: ${error.message}`)
      },
    })

    render()
    expect(receivedError).toBe(testError)
    expect(receivedRefresh).toBeTypeOf('function')
  })

  it('prioritizes error over loading when both are set', () => {
    initRouteMeta('credential', { loading: true, error: new Error('fail') })

    let errorRendered = false

    const { render } = renderComponent({
      default: () => h('div', 'Page Content'),
      loading: () => h('div', 'Loading...'),
      error: ({ error }: { error: Error }) => {
        errorRendered = true

        return h('div', `Error: ${error.message}`)
      },
    })

    render()
    expect(errorRendered).toBe(true)
  })

  it('passes { Component, route } to the default slot when no injection state exists yet', () => {
    let receivedComponent: unknown = null

    const { render } = renderComponent({
      default: ({ Component }: { Component: unknown }) => {
        receivedComponent = Component

        return h('div', 'Page Content')
      },
      loading: () => h('div', 'Loading...'),
      error: () => h('div', 'Error!'),
    })

    render()
    expect(receivedComponent).toBe(MockPageComponent)
  })

  it('renders errorComponent from route meta when resource has an error', () => {
    const testError = new Error('Server error')
    initRouteMeta('credential', { loading: false, error: testError })

    const ErrorPage = defineComponent({
      props: { error: { type: Error, required: true }, refresh: { type: Function, required: true } },
      render() {
        return h('div', `ErrorPage: ${this.error.message}`)
      },
    })
    mockRoute.meta._errorComponent = markRaw(ErrorPage)

    const { render } = renderComponent({
      default: () => h('div', 'Page Content'),
    })

    const vnode = render()

    // renderContent returns h(ErrorPage, ...) which the RouterView slot resolver unwraps
    expect(vnode).toBeDefined()
    const node = Array.isArray(vnode) ? vnode[0] : vnode
    expect((node as VNode).type).toBe(ErrorPage)
    expect((node as VNode).props?.error).toBe(testError)
    expect((node as VNode).props?.refresh).toBeTypeOf('function')
  })

  it('renders loadingComponent from route meta while resource is loading', () => {
    initRouteMeta('credential', { loading: true, error: null })

    const LoadingPage = defineComponent({
      render() {
        return h('div', 'LoadingPage')
      },
    })
    mockRoute.meta._loadingComponent = markRaw(LoadingPage)

    let defaultSlotCalled = false
    const { render } = renderComponent({
      default: () => {
        defaultSlotCalled = true

        return h('div', 'Page Content')
      },
    })

    const vnode = render()
    const node = Array.isArray(vnode) ? vnode[0] : vnode
    expect((node as VNode).type).toBe(LoadingPage)
    expect(defaultSlotCalled).toBe(false)
  })

  it('refresh function in error slot retries all errored props', async () => {
    mockRoute.meta._injectionState = reactive({
      credential: reactive({ loading: false, error: new Error('fail') }),
      organization: reactive({ loading: false, error: new Error('also fail') }),
    })
    mockRoute.meta._injectedProps = reactive({})

    const refreshMock = vi.fn().mockResolvedValue('refreshed')
    mockRoute.meta.refresh = refreshMock

    let capturedRefresh: (() => Promise<unknown>) | null = null

    const { render } = renderComponent({
      error: ({ refresh }: { refresh: () => Promise<unknown> }) => {
        capturedRefresh = refresh

        return h('div', 'Error')
      },
    })

    render()
    expect(capturedRefresh).toBeTypeOf('function')

    await capturedRefresh!()
    expect(refreshMock).toHaveBeenCalledWith('credential')
    expect(refreshMock).toHaveBeenCalledWith('organization')
    expect(refreshMock).toHaveBeenCalledTimes(2)
  })

  it('renders the Component automatically when no default slot is provided', () => {
    initRouteMeta('credential', { loading: false, error: null })

    const { render } = renderComponent()

    const vnode = render()
    const node = Array.isArray(vnode) ? vnode[0] : vnode
    expect((node as VNode).type).toBe(MockPageComponent)
  })

  it('renders the default slot during loading when lazy is false', () => {
    initRouteMeta('credential', { loading: true, error: null })
    mockRoute.meta._lazy = false

    let defaultCalled = false

    const { render } = renderComponent({
      default: () => {
        defaultCalled = true

        return h('div', 'Page Content')
      },
      loading: () => h('div', 'Loading...'),
    })

    render()
    expect(defaultCalled).toBe(true)
  })

  it('renders the default slot during error when lazy is false', () => {
    initRouteMeta('credential', { loading: false, error: new Error('fail') })
    mockRoute.meta._lazy = false

    let defaultCalled = false

    const { render } = renderComponent({
      default: () => {
        defaultCalled = true

        return h('div', 'Page Content')
      },
      error: () => h('div', 'Error!'),
    })

    render()
    expect(defaultCalled).toBe(true)
  })

  it('still intercepts loading/error when lazy is true (default)', () => {
    initRouteMeta('credential', { loading: true, error: null })

    let loadingCalled = false

    const { render } = renderComponent({
      default: () => h('div', 'Page Content'),
      loading: () => {
        loadingCalled = true

        return h('div', 'Loading...')
      },
    })

    render()
    expect(loadingCalled).toBe(true)
  })
})
