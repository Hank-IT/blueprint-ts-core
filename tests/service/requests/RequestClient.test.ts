import { PreconditionRequiredException } from '../../../src/requests/exceptions'
import { describe, expect, it, vi } from 'vitest'
import {
  BaseRequest,
  RequestClient,
  RequestEvents,
  JsonResponse,
  JsonBodyFactory,
  RequestMethodEnum,
  createMockRequestScope,
  createRequestContextKey,
  RequestContext,
  deferredResponse,
  jsonResponse,
  expectJsonBody
} from '../../../src/requests'

class Save extends BaseRequest<boolean, object, object, JsonResponse<object>, { name: string }> {
  public url() {
    return '/save'
  }
  public method() {
    return RequestMethodEnum.PATCH
  }
  public getResponse() {
    return new JsonResponse<object>()
  }
  public override getRequestBodyFactory() {
    return new JsonBodyFactory<{ name: string }>()
  }
}

describe('RequestClient ownership and subscriptions', () => {
  it('captures the default client at construction and isolates explicitly supplied clients', async () => {
    const parent = createMockRequestScope({ client: new RequestClient({ baseUrl: 'https://parent.test' }) })
    const request = new Save()
    const child = createMockRequestScope({ client: new RequestClient({ baseUrl: 'https://child.test' }) })
    const independent = createMockRequestScope({ client: new RequestClient({ baseUrl: 'https://other.test' }), makeDefault: false })
    try {
      parent.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://parent.test/save' }).respond(jsonResponse(200, { parent: true }))
      child.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://child.test/save' }).respond(jsonResponse(200, { child: true }))
      independent.driver
        .expectAny({ method: RequestMethodEnum.PATCH, url: 'https://other.test/save' })
        .respond(jsonResponse(200, { independent: true }))
      expect((await request.send()).getBody()).toEqual({ parent: true })
      expect((await new Save().send()).getBody()).toEqual({ child: true })
      expect((await new Save(independent.client).send()).getBody()).toEqual({ independent: true })
      expect(BaseRequest.getDefaultClient()).toBe(child.client)
    } finally {
      independent.dispose()
      child.dispose()
      parent.dispose()
    }
  })

  it('snapshots listeners per send, orders shared listeners before local ones, and unsubscribes independently', async () => {
    const scope = createMockRequestScope({ client: new RequestClient({ baseUrl: 'https://example.test' }) })
    try {
      const calls: string[] = []
      const shared = () => {
        calls.push('shared')
      }
      const remove = scope.client.on(RequestEvents.BEFORE_SERIALIZE, shared)
      scope.client.on(RequestEvents.BEFORE_SERIALIZE, shared)
      const request = new Save()
      request.on(RequestEvents.BEFORE_SERIALIZE, () => {
        remove()
        calls.push('local')
      })
      scope.driver.allow({ method: RequestMethodEnum.PATCH, url: 'https://example.test/save' }, jsonResponse(200, {}), { maxCalls: 2 })
      await request.send()
      await request.send()
      expect(calls).toEqual(['shared', 'shared', 'local', 'shared', 'local'])
    } finally {
      scope.dispose()
    }
  })

  it('awaits preparation and response processing sequentially', async () => {
    const scope = createMockRequestScope({ client: new RequestClient({ baseUrl: 'https://example.test' }) })
    try {
      const calls: string[] = []
      scope.client.on(RequestEvents.BEFORE_SERIALIZE, async (_, prepared) => {
        await Promise.resolve()
        prepared.body = { name: 'prepared' }
        calls.push('shared')
      })
      scope.client.on(RequestEvents.RECEIVED, async () => {
        await Promise.resolve()
        calls.push('received')
      })
      const request = new Save()
      request.on(RequestEvents.BEFORE_SERIALIZE, (_, prepared) => {
        expect(prepared.body).toEqual({ name: 'prepared' })
        calls.push('local')
      })
      request.on(RequestEvents.DECODED, async () => {
        await Promise.resolve()
        calls.push('decoded')
      })
      scope.driver
        .expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/save' })
        .withBody(expectJsonBody({ name: 'prepared' }))
        .respond(jsonResponse(200, {}))
      await request.send()
      expect(calls).toEqual(['shared', 'local', 'received', 'decoded'])
    } finally {
      scope.dispose()
    }
  })

  it.each(['sync', 'async'] as const)('reports %s notification errors without changing the original failure', async (kind) => {
    const report = vi.fn()
    const scope = createMockRequestScope({ client: new RequestClient({ baseUrl: 'https://example.test', onListenerError: report }) })
    try {
      const listenerError = new Error('observer failed')
      const observer = () => {
        if (kind === 'async') return Promise.reject(listenerError)
        throw listenerError
      }
      const local = vi.fn()
      scope.client.on(RequestEvents.FAILED, observer)
      scope.client.on(RequestEvents.LOADING, observer)
      const request = new Save()
      request.on(RequestEvents.FAILED, local)
      scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/save' }).respond(jsonResponse(428, { field: 'revision' }))
      const error = await request.send().catch((error: unknown) => error)
      expect(local.mock.calls[0]![1]).toBe(error)
      expect(error).toBeInstanceOf(PreconditionRequiredException)
      await Promise.resolve()
      expect(report).toHaveBeenCalledWith(listenerError, RequestEvents.FAILED, expect.anything())
      expect(scope.client.getActiveRequestCount()).toBe(0)
    } finally {
      scope.dispose()
    }
  })

  it('contains a rejection from an asynchronous listener error reporter', async () => {
    const reporterError = new Error('reporting failed')
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const scope = createMockRequestScope({
      client: new RequestClient({
        baseUrl: 'https://example.test',
        onListenerError: async () => {
          throw reporterError
        }
      })
    })
    try {
      scope.client.on(RequestEvents.FAILED, () => {
        throw new Error('observer failed')
      })
      scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/save' }).respond(jsonResponse(428, {}))
      await expect(new Save().send()).rejects.toBeInstanceOf(PreconditionRequiredException)
      await Promise.resolve()
      expect(report).toHaveBeenCalledWith(reporterError)
      expect(scope.client.getActiveRequestCount()).toBe(0)
    } finally {
      scope.dispose()
      report.mockRestore()
    }
  })

  it.each(['prepare', 'serialize', 'loading'] as const)('releases accounting when %s fails before transport', async (stage) => {
    const scope = createMockRequestScope({ client: new RequestClient({ baseUrl: 'https://example.test' }) })
    try {
      const error = new Error(stage)
      const request = new Save()
      if (stage === 'prepare')
        request.on(RequestEvents.BEFORE_SERIALIZE, () => {
          throw error
        })
      if (stage === 'serialize')
        vi.spyOn(request, 'getRequestBodyFactory').mockImplementation(() => {
          throw error
        })
      if (stage === 'loading')
        request.setRequestLoader({
          isLoading: () => false,
          setLoading: (value) => {
            if (value) throw error
          }
        })
      await expect(request.setBody({ name: 'edit' }).send()).rejects.toBe(error)
      expect(scope.driver.getHistory()).toHaveLength(0)
      expect(scope.client.getActiveRequestCount()).toBe(0)
      expect(() => request.setClient(scope.client)).not.toThrow()
    } finally {
      scope.dispose()
    }
  })

  it('prevents client rebinding during a send and retains caught mismatches during reset', async () => {
    const scope = createMockRequestScope({ client: new RequestClient({ baseUrl: 'https://example.test' }) })
    const deferred = deferredResponse()
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/save' }).respond(deferred.respond)
    const request = new Save()
    const pending = request.send()
    expect(() => request.setClient(new RequestClient())).toThrow('running')
    deferred.resolve(jsonResponse(200, {}))
    await pending
    await request.send().catch(() => undefined)
    expect(() => scope.driver.reset()).toThrow('Unexpected request')
    expect(scope.driver.getHistory()).toHaveLength(2)
    expect(() => scope.dispose()).toThrow('Unexpected request')
  })

  it('snapshots application context when binding it to a request', () => {
    const key = createRequestContextKey<{ locale: string }>('locale')
    const value = { locale: 'en' }
    const request = new Save().setContext(new RequestContext().with(key, value))
    value.locale = 'de'
    request.setBody({ name: 'edited' })
    expect(request.getContext().require(key)).toEqual({ locale: 'en' })
    expect(Object.isFrozen(request.getContext().require(key))).toBe(true)
  })
})
