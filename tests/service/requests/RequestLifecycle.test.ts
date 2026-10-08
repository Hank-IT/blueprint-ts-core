import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BaseRequest,
  JsonResponse,
  BlobResponse,
  JsonBodyFactory,
  FetchDriver,
  XMLHttpRequestDriver,
  RequestMethodEnum,
  RequestConcurrencyMode,
  RequestEvents,
  createMockRequestScope,
  createRequestContextKey,
  deferredResponse,
  RequestContext,
  expectJsonBody,
  getMockRequestJsonBody,
  jsonResponse
} from '../../../src/requests'
import { ResponseBodyException, PreconditionRequiredException, UnsupportedTransportOptionException } from '../../../src/requests/exceptions'
import { StaleResponseException } from '../../../src/requests/exceptions/StaleResponseException'

class EditRequest extends BaseRequest<boolean, object, object, JsonResponse<object>, { name: string; token?: string }> {
  public method() {
    return RequestMethodEnum.PATCH
  }
  public url() {
    return '/editor'
  }
  public getResponse() {
    return new JsonResponse<object>()
  }
  public override getRequestBodyFactory() {
    return new JsonBodyFactory<{ name: string; token?: string }>()
  }
}

describe('shared request lifecycle', () => {
  let scope: ReturnType<typeof createMockRequestScope>
  beforeEach(() => {
    scope = createMockRequestScope()
    BaseRequest.getDefaultClient().setBaseUrl('https://example.test')
  })
  afterEach(() => {
    try {
      scope.dispose()
    } finally {
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    }
  })

  it('keeps a successful request and cleans up when a loading observer throws', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }).respond(jsonResponse(200, { saved: true }))
    const request = new EditRequest()
    request.on(RequestEvents.LOADING, () => {
      throw new Error('observer failure')
    })
    expect((await request.send()).getBody()).toEqual({ saved: true })
    expect(report).toHaveBeenCalled()
  })

  it('runs production listeners with a mock driver, snapshots context and serializes the hook output', async () => {
    const key = createRequestContextKey<{ tokens: Record<string, string> }>('revision')
    const original = { tokens: { owner: 'loaded' } }
    const decoded = vi.fn()
    scope.client.on(RequestEvents.BEFORE_SERIALIZE, (request, prepared) => {
      prepared.body = { ...(prepared.body as object), token: request.context.require(key).tokens['owner'] }
    })
    scope.client.on(RequestEvents.DECODED, decoded)
    const request = new EditRequest().setBody({ name: 'edited' }).setContext(new RequestContext().with(key, original))
    original.tokens['owner'] = 'background-refresh'
    scope.driver
      .expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' })
      .withBody(expectJsonBody({ name: 'edited', token: 'loaded' }))
      .respond(jsonResponse(200, { name: 'saved' }))
    const response = await request.send()
    expect(response.getBody()).toEqual({ name: 'saved' })
    expect(decoded).toHaveBeenCalledOnce()
    expect(Object.isFrozen(decoded.mock.calls[0]![0].context.require(key).tokens)).toBe(true)
  })

  it.each([428, 418])('preserves the parsed body for status %s and normalizes only once', async (status) => {
    const failed = vi.fn()
    scope.client.on(RequestEvents.FAILED, failed)
    const body = { code: 'configuration_precondition_required', field: 'expected_revision_token', message: 'Required' }
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }).respond(jsonResponse(status, body))
    const error = await new EditRequest().send().catch((error: unknown) => error)
    expect(error).toBeInstanceOf(status === 428 ? PreconditionRequiredException : ResponseBodyException)
    expect((error as ResponseBodyException<object>).getBody()).toEqual(body)
    expect(failed).toHaveBeenCalledOnce()
    expect(failed.mock.calls[0]![1]).toBe(error)
  })

  it('leaves raw and empty responses undecoded', async () => {
    const decoded = vi.fn()
    const received = vi.fn()
    scope.client.on(RequestEvents.DECODED, decoded)
    scope.client.on(RequestEvents.RECEIVED, received)
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }).respond({ status: 204 })
    expect((await new EditRequest().send({ resolveBody: false })).getStatusCode()).toBe(204)
    expect(received).toHaveBeenCalledOnce()
    expect(decoded).not.toHaveBeenCalled()
  })

  it('keeps binary decoding available to extensions', async () => {
    class Download extends BaseRequest<boolean, object, Blob, BlobResponse> {
      public method() {
        return RequestMethodEnum.GET
      }
      public url() {
        return '/blob'
      }
      public getResponse() {
        return new BlobResponse()
      }
    }
    const decoded = vi.fn()
    scope.driver.expectAny({ method: RequestMethodEnum.GET, url: 'https://example.test/blob' }).respond({ status: 200, body: 'binary' })
    const request = new Download()
    request.on(RequestEvents.DECODED, decoded)
    const response = await request.send()
    expect(decoded.mock.calls[0]![1]).toBe(response.getBody())
    expect(response.getBody().size).toBe(6)
  })

  it('suppresses global error effects and loading while still rejecting locally', async () => {
    const global = vi.fn()
    const loading = vi.fn()
    scope.client.on(RequestEvents.FAILED, global)
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }).respond(jsonResponse(428, { code: 'required' }))
    const request = new EditRequest()
    request.on(RequestEvents.LOADING, loading)
    await expect(request.send({ globalErrorHandling: false, loading: false })).rejects.toBeInstanceOf(PreconditionRequiredException)
    expect(global).not.toHaveBeenCalled()
    expect(loading).not.toHaveBeenCalled()
  })

  it('rechecks concurrency after asynchronous response hooks', async () => {
    let release!: () => void
    let started!: () => void
    const paused = new Promise<void>((resolve) => {
      release = resolve
    })
    const entered = new Promise<void>((resolve) => {
      started = resolve
    })
    let first = true
    const decoded = async () => {
      if (first) {
        first = false
        started()
        await paused
      }
    }
    scope.driver.allow({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }, jsonResponse(200, {}), { maxCalls: 2 })
    const request = new EditRequest().setConcurrency({ mode: RequestConcurrencyMode.LATEST })
    request.on(RequestEvents.DECODED, decoded)
    const old = request.send().catch((error: unknown) => error)
    await entered
    await request.send()
    release()
    expect(await old).toBeInstanceOf(StaleResponseException)
  })

  it('does not mix context between simultaneous sends of one request', async () => {
    const key = createRequestContextKey<string>('token')
    const deferred = deferredResponse()
    const contexts: string[] = []
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }).respond(deferred.respond)
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }).respond(jsonResponse(200, {}))
    const request = new EditRequest()
    request.on(RequestEvents.DECODED, (snapshot) => {
      contexts.push(snapshot.context.require(key))
    })
    const first = request.setBody({ name: 'first' }).setContext(new RequestContext().with(key, 'first')).send()
    await vi.waitFor(() => expect(scope.driver.getHistory()).toHaveLength(1))
    await request.setBody({ name: 'second' }).setContext(new RequestContext().with(key, 'second')).send()
    deferred.resolve(jsonResponse(200, {}))
    await first
    expect(contexts).toEqual(['second', 'first'])
  })

  it.each([true, false, undefined])('forwards keepalive=%s with auth, body and dynamic headers through Fetch', async (keepalive) => {
    let csrf = 'initial'
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const driver = new FetchDriver({ keepalive: true, corsWithCredentials: true, headers: { 'X-CSRF': () => csrf } })
    const hooks = vi.fn()
    scope.client.on(RequestEvents.DECODED, hooks)
    const request = new EditRequest().setRequestDriver(driver).setBody({ name: 'Ada' })
    csrf = 'current'
    await request.send(keepalive === undefined ? {} : { keepalive })
    expect(fetch.mock.calls[0]![1]).toMatchObject({
      keepalive: keepalive ?? true,
      credentials: 'include',
      headers: { 'X-CSRF': 'current' },
      method: 'PATCH',
      body: '{"name":"Ada"}'
    })
    expect(hooks).toHaveBeenCalledOnce()
  })

  it('dispatches a keepalive fetch synchronously when preparation hooks are synchronous', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    scope.client.on(RequestEvents.BEFORE_SERIALIZE, () => undefined)
    const pending = new EditRequest()
      .setRequestDriver(new FetchDriver())
      .send({ keepalive: true, detached: true, loading: false, resolveBody: false })
    expect(fetch).toHaveBeenCalledOnce()
    await pending
  })

  it('keeps body and context independent and allows context to be explicitly cleared', async () => {
    const key = createRequestContextKey<string>('revision')
    const context = new RequestContext().with(key, 'loaded')
    const seen: Array<string | undefined> = []
    scope.client.on(RequestEvents.BEFORE_SERIALIZE, (request) => {
      seen.push(request.context.get(key))
    })
    scope.driver.allow({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }, jsonResponse(200, {}), { maxCalls: 2 })
    const request = new EditRequest().setBody({ name: 'Ada' }).setContext(context)
    await request.send()
    await request.setBody({ name: 'fresh' }).send()
    expect(seen).toEqual(['loaded', 'loaded'])
    expect(request.getContext()).toBe(context)
    request.setContext(new RequestContext())
    expect(request.getContext().get(key)).toBeUndefined()
    expect(scope.driver.getHistory().map(getMockRequestJsonBody)).toEqual([{ name: 'Ada' }, { name: 'fresh' }])
  })

  it('runs the same hooks and serialization through XHR', async () => {
    const sent = vi.fn()
    class Xhr {
      status = 200
      statusText = 'OK'
      response = '{"saved":true}'
      onload: (() => void) | null = null
      onabort: (() => void) | null = null
      upload = {}
      open() {}
      setRequestHeader() {}
      getAllResponseHeaders() {
        return 'Content-Type: application/json'
      }
      send(body: unknown) {
        sent(body)
        this.onload?.()
      }
      abort() {
        this.onabort?.()
      }
    }
    vi.stubGlobal('XMLHttpRequest', Xhr)
    const decoded = vi.fn()
    scope.client.on(RequestEvents.BEFORE_SERIALIZE, (_, prepared) => {
      prepared.body = { ...(prepared.body as object), token: 'xhr' }
    })
    scope.client.on(RequestEvents.DECODED, decoded)
    const response = await new EditRequest()
      .setBody({ name: 'Ada' })
      .setRequestDriver(new XMLHttpRequestDriver({ keepalive: true }))
      .send({ keepalive: false })
    expect(sent).toHaveBeenCalledWith('{"name":"Ada","token":"xhr"}')
    expect(response.getBody()).toEqual({ saved: true })
    expect(decoded).toHaveBeenCalledOnce()
  })

  it('rejects keepalive for XHR before opening a connection', async () => {
    await expect(new EditRequest().setRequestDriver(new XMLHttpRequestDriver()).send({ keepalive: true })).rejects.toBeInstanceOf(
      UnsupportedTransportOptionException
    )
  })

  it('detaches cleanup from a disposed scope and an already aborted page signal', async () => {
    const deferred = deferredResponse()
    const controller = new AbortController()
    controller.abort()
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }).respond(deferred.respond)
    const pending = new EditRequest().setAbortSignal(controller.signal).send({ detached: true, keepalive: true, loading: false })
    await vi.waitFor(() => expect(scope.driver.getHistory()).toHaveLength(1))
    expect(scope.driver.getHistory()[0]!.config?.abortSignal).toBeUndefined()
    scope.dispose()
    deferred.resolve(jsonResponse(200, {}))
    await pending
  })

  it('records and retains unexpected traffic even when caught', async () => {
    await new EditRequest().send().catch(() => undefined)
    expect(scope.driver.getHistory()).toHaveLength(1)
    expect(() => scope.dispose()).toThrow('Unexpected request')
  })

  it('retains failures after a bounded stub is exhausted', async () => {
    let revision = 0
    scope.driver.allow({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }, () => jsonResponse(200, { revision: ++revision }), {
      maxCalls: 2
    })
    expect((await new EditRequest().send()).getBody()).toEqual({ revision: 1 })
    expect((await new EditRequest().send()).getBody()).toEqual({ revision: 2 })
    await new EditRequest().send().catch(() => undefined)
    expect(scope.driver.getHistory()).toHaveLength(3)
    expect(() => scope.dispose()).toThrow('Unexpected request')
  })

  it('restores configuration and aborts unfinished requests when a nested scope closes', async () => {
    const nested = createMockRequestScope()
    const deferred = deferredResponse()
    nested.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }).respond(deferred.respond)
    const pending = new EditRequest().send().catch((error: unknown) => error)
    await vi.waitFor(() => expect(nested.driver.getHistory()).toHaveLength(1))
    nested.dispose()
    expect(await pending).toMatchObject({ name: 'AbortError' })
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/editor' }).respond(jsonResponse(200, {}))
    await new EditRequest().send()
  })
})
