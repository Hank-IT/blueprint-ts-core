import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { BulkRequestSender, BulkRequestWrapper } from '../../../src/bulkRequests'
import {
  BaseRequest,
  JsonResponse,
  RequestEvents,
  RequestMethodEnum,
  deferredResponse,
  installMockRequestDriver,
  jsonResponse
} from '../../../src/requests'
import { VueRequestLoaderFactory } from '../../../src/vue/requests/factories/VueRequestLoaderFactory'

class Write extends BaseRequest<Ref<boolean>, object, { saved: boolean }, JsonResponse<{ saved: boolean }>> {
  public method() {
    return RequestMethodEnum.PATCH
  }
  public url() {
    return '/write'
  }
  public getResponse() {
    return new JsonResponse<{ saved: boolean }>()
  }
}

describe('BulkRequestWrapper', () => {
  let driver: ReturnType<typeof installMockRequestDriver>
  beforeEach(() => {
    BaseRequest.getDefaultClient().setBaseUrl('https://example.test').setLoaderFactory(new VueRequestLoaderFactory())
    driver = installMockRequestDriver()
  })

  it('tracks the request loader until a deferred response completes', async () => {
    const deferred = deferredResponse()
    driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/write' }).respond(deferred.respond)
    const request = new Write()
    const wrapper = new BulkRequestWrapper(request)
    expect(wrapper.getOutcome()).toBe('pending')
    expect(wrapper.isLoading().value).toBe(false)

    const pending = wrapper.send()
    await vi.waitFor(() => expect(driver.getHistory()).toHaveLength(1))
    expect(wrapper.getOutcome()).toBe('running')
    expect(wrapper.isLoading().value).toBe(true)
    deferred.resolve(jsonResponse(200, { saved: true }))
    await pending

    expect(wrapper.getRequest()).toBe(request)
    expect(wrapper.getOutcome()).toBe('succeeded')
    expect(wrapper.getResponse()?.getBody()).toEqual({ saved: true })
    expect(wrapper.getError()).toBeNull()
    expect(wrapper.hasError()).toBe(false)
    expect(wrapper.wasSent()).toBe(true)
    expect(wrapper.isLoading().value).toBe(false)
  })

  it('replaces the previous response with the error from a subsequent failed send', async () => {
    driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/write' }).respond(jsonResponse(200, { saved: true }))
    driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/write' }).respond(jsonResponse(503, { message: 'Unavailable' }))
    const wrapper = new BulkRequestWrapper(new Write())
    await wrapper.send()
    await wrapper.send()
    expect(wrapper.getOutcome()).toBe('failed')
    expect(wrapper.getResponse()).toBeNull()
    expect(wrapper.getError()).toBeInstanceOf(Error)
    expect(wrapper.hasError()).toBe(true)
    expect(wrapper.wasSent()).toBe(true)
    expect(wrapper.isLoading().value).toBe(false)
  })

  it('clears a previous success without sending when the next signal is already aborted', async () => {
    driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/write' }).respond(jsonResponse(200, { saved: true }))
    const wrapper = new BulkRequestWrapper(new Write())
    await wrapper.send()
    const controller = new AbortController()
    controller.abort()
    await wrapper.send(controller.signal)
    expect(wrapper.getOutcome()).toBe('cancelled')
    expect(wrapper.getResponse()).toBeNull()
    expect(wrapper.getError()).toMatchObject({ name: 'AbortError' })
    expect(wrapper.wasSent()).toBe(false)
    expect(driver.getHistory()).toHaveLength(1)
  })

  it('forwards cancellation to an in-flight request and clears loading', async () => {
    const deferred = deferredResponse()
    driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/write' }).respond(deferred.respond)
    const controller = new AbortController()
    const wrapper = new BulkRequestWrapper(new Write())
    const pending = wrapper.send(controller.signal)
    await vi.waitFor(() => expect(driver.getHistory()).toHaveLength(1))
    controller.abort()
    await pending
    expect(driver.getHistory()[0]!.config?.abortSignal?.aborted).toBe(true)
    expect(wrapper.getOutcome()).toBe('cancelled')
    expect(wrapper.getResponse()).toBeNull()
    expect(wrapper.getError()).toMatchObject({ name: 'AbortError' })
    expect(wrapper.wasSent()).toBe(true)
    expect(wrapper.isLoading().value).toBe(false)
    deferred.resolve(jsonResponse(200, { saved: true }))
  })

  it('does not count a response as successful when cancellation arrives during request cleanup', async () => {
    driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/write' }).respond(jsonResponse(200, { saved: true }))
    const controller = new AbortController()
    const request = new Write()
    request.on(RequestEvents.LOADING, (loading) => {
      if (!loading) controller.abort()
    })
    const wrapper = new BulkRequestWrapper(request)
    await wrapper.send(controller.signal)
    expect(wrapper.getOutcome()).toBe('cancelled')
    expect(wrapper.getResponse()).toBeNull()
    expect(wrapper.getError()).toMatchObject({ name: 'AbortError' })
    expect(wrapper.wasSent()).toBe(true)
  })

  it.each(['beforeSend', 'succeeded'] as const)('records a %s failure and cancels dependent operations', async (stage) => {
    if (stage === 'succeeded') {
      driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/write' }).respond(jsonResponse(200, { saved: true }))
    }
    const error = new Error('Application processing failed')
    const first = new BulkRequestWrapper(new Write())
    const dependent = new BulkRequestWrapper(new Write())
    const sender = new BulkRequestSender([first, dependent]).setScheduling({
      keys: () => ['shared-owner'],
      [stage]: () => {
        throw error
      }
    })
    const result = await sender.send()
    expect(result.getSuccessCount()).toBe(0)
    expect(result.getErrorCount()).toBe(1)
    expect(result.getCancelledCount()).toBe(1)
    expect(result.getFailedResponses()).toEqual([error])
    expect(first.getResponse()).toBeNull()
    expect(first.getError()).toBe(error)
    expect(first.wasSent()).toBe(stage === 'succeeded')
    expect(dependent.wasSent()).toBe(false)
    expect(sender.isLoading).toBe(false)
  })
})
