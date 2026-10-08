import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BaseRequest,
  JsonResponse,
  RequestEvents,
  RequestMethodEnum,
  RequestConcurrencyMode,
  StaleResponseException,
  createMockRequestScope,
  jsonResponse
} from '../../../src/requests'
import { ResponseException, UnauthorizedException } from '../../../src/requests/exceptions'
import { MockResponseHandler } from '../../../src/requests/drivers/mock/MockResponseHandler'

class Read extends BaseRequest<boolean, object, object, JsonResponse<object>> {
  public method() {
    return RequestMethodEnum.GET
  }
  public url() {
    return '/resource'
  }
  public getResponse() {
    return new JsonResponse<object>()
  }
}

describe('response error processing', () => {
  let scope: ReturnType<typeof createMockRequestScope>
  beforeEach(() => {
    scope = createMockRequestScope()
    scope.client.setBaseUrl('https://example.test')
  })
  afterEach(() => {
    try {
      scope.dispose()
    } finally {
      vi.restoreAllMocks()
    }
  })
  const expectError = () => scope.driver.expectAny({ method: RequestMethodEnum.GET, url: 'https://example.test/resource' })

  it.each([
    ['sync', 'throwing'],
    ['async', 'throwing'],
    ['sync', 'returning'],
    ['async', 'returning']
  ] as const)('stops processing for %s false with a %s transport while preserving local rejection', async (timing, transport) => {
    expectError().respond({ status: 401, body: '<html>Unauthorized</html>' })
    const send = scope.driver.send.bind(scope.driver)
    let transportError: ResponseException | undefined
    vi.spyOn(scope.driver, 'send').mockImplementation(async (...args) => {
      try {
        return await send(...args)
      } catch (error) {
        if (!(error instanceof ResponseException)) throw error
        transportError = error
        if (transport === 'returning') return error.getResponse()
        throw error
      }
    })
    const parse = vi.spyOn(MockResponseHandler.prototype, 'json')
    const calls: string[] = []
    const sharedFailure = vi.fn()
    const localFailure = vi.fn()
    scope.client.on(RequestEvents.RESPONSE_ERROR, (_request, response) => {
      expect(response.getStatusCode()).toBe(401)
      calls.push('handled')
      return timing === 'async' ? Promise.resolve(false) : false
    })
    scope.client.on(RequestEvents.RESPONSE_ERROR, () => {
      calls.push('later shared')
    })
    scope.client.on(RequestEvents.FAILED, sharedFailure)
    const request = new Read()
    request.on(RequestEvents.RESPONSE_ERROR, () => {
      calls.push('local response')
    })
    request.on(RequestEvents.FAILED, localFailure)
    const loading = vi.fn()
    request.on(RequestEvents.LOADING, loading)
    const error = await request.send().catch((failure: unknown) => failure)
    expect(error).toBeInstanceOf(ResponseException)
    expect((error as ResponseException).constructor).toBe(ResponseException)
    expect((error as ResponseException).getResponse()).toBe(transportError!.getResponse())
    if (transport === 'throwing') expect(error).toBe(transportError)
    expect(calls).toEqual(['handled'])
    expect(parse).not.toHaveBeenCalled()
    expect(sharedFailure).not.toHaveBeenCalled()
    expect(localFailure).toHaveBeenCalledWith(expect.anything(), error)
    expect(loading.mock.calls.map(([value]) => value)).toEqual([true, false])
    expect(scope.client.getActiveRequestCount()).toBe(0)
  })

  it('awaits shared and local handlers in order before normalizing exactly once', async () => {
    expectError().respond(jsonResponse(401, { message: 'Sign in' }))
    const parse = vi.spyOn(MockResponseHandler.prototype, 'json')
    const calls: string[] = []
    scope.client.on(RequestEvents.RESPONSE_ERROR, async () => {
      await Promise.resolve()
      expect(parse).not.toHaveBeenCalled()
      calls.push('shared')
      return true
    })
    const request = new Read()
    request.on(RequestEvents.RESPONSE_ERROR, () => {
      expect(parse).not.toHaveBeenCalled()
      calls.push('local')
    })
    scope.client.on(RequestEvents.FAILED, (_request, error) => {
      expect(error).toBeInstanceOf(UnauthorizedException)
      calls.push('shared failure')
    })
    request.on(RequestEvents.FAILED, () => {
      calls.push('local failure')
    })
    await expect(request.send()).rejects.toBeInstanceOf(UnauthorizedException)
    expect(calls).toEqual(['shared', 'local', 'shared failure', 'local failure'])
    expect(parse).toHaveBeenCalledOnce()
  })

  it.each([true, false])('skips shared handlers with global handling disabled and local continuation=%s', async (proceed) => {
    expectError().respond(jsonResponse(401, {}))
    const shared = vi.fn()
    scope.client.on(RequestEvents.RESPONSE_ERROR, shared)
    scope.client.on(RequestEvents.FAILED, shared)
    const request = new Read()
    const localResponse = vi.fn(() => proceed)
    const localFailure = vi.fn()
    request.on(RequestEvents.RESPONSE_ERROR, localResponse)
    request.on(RequestEvents.FAILED, localFailure)
    const error = await request.send({ globalErrorHandling: false }).catch((failure: unknown) => failure)
    expect((error as Error).constructor).toBe(proceed ? UnauthorizedException : ResponseException)
    expect(shared).not.toHaveBeenCalled()
    expect(localResponse).toHaveBeenCalledOnce()
    expect(localFailure).toHaveBeenCalledWith(expect.anything(), error)
  })

  it.each(['sync', 'async'] as const)('rejects and cleans up after a %s handler failure', async (timing) => {
    expectError().respond(jsonResponse(401, {}))
    const failure = new Error('Handler failed')
    const parse = vi.spyOn(MockResponseHandler.prototype, 'json')
    scope.client.on(RequestEvents.RESPONSE_ERROR, () => {
      if (timing === 'async') return Promise.reject(failure)
      throw failure
    })
    const notified = vi.fn()
    scope.client.on(RequestEvents.FAILED, notified)
    const request = new Read()
    const loading = vi.fn()
    request.on(RequestEvents.LOADING, loading)
    await expect(request.send()).rejects.toBe(failure)
    expect(parse).not.toHaveBeenCalled()
    expect(notified).toHaveBeenCalledWith(expect.anything(), failure)
    expect(loading.mock.calls.map(([value]) => value)).toEqual([true, false])
    expect(scope.client.getActiveRequestCount()).toBe(0)
  })

  it.each(['abort', 'stale'] as const)('checks %s state after awaiting response error handling', async (kind) => {
    expectError().respond(jsonResponse(401, {}))
    let entered!: () => void
    let release!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    scope.client.on(RequestEvents.RESPONSE_ERROR, async () => {
      entered()
      await gate
      return false
    })
    const failed = vi.fn()
    scope.client.on(RequestEvents.FAILED, failed)
    const controller = new AbortController()
    const request = new Read().setAbortSignal(controller.signal).setConcurrency({ mode: RequestConcurrencyMode.LATEST })
    request.on(RequestEvents.FAILED, failed)
    const pending = request.send().catch((error: unknown) => error)
    await started
    if (kind === 'abort') controller.abort()
    else {
      expectError().respond(jsonResponse(200, { current: true }))
      await request.send()
    }
    release()
    const error = await pending
    if (kind === 'abort') expect(error).toMatchObject({ name: 'AbortError' })
    else expect(error).toBeInstanceOf(StaleResponseException)
    expect(failed).not.toHaveBeenCalled()
    expect(scope.client.getActiveRequestCount()).toBe(0)
  })
})
