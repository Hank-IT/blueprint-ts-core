import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BulkRequestSender, BulkRequestWrapper, BulkRequestEventEnum, BulkRequestExecutionMode } from '../../../src/bulkRequests'
import { BaseRequest, JsonResponse, RequestMethodEnum, createMockRequestScope, deferredResponse, jsonResponse } from '../../../src/requests'

class Write extends BaseRequest<boolean, object, object, JsonResponse<object>> {
  public constructor(
    public readonly owner: string,
    private readonly operation: string
  ) {
    super()
  }
  public method() {
    return RequestMethodEnum.PATCH
  }
  public url() {
    return `/${this.operation}`
  }
  public getResponse() {
    return new JsonResponse<object>()
  }
}
const wrap = (owner: string, operation: string) => new BulkRequestWrapper(new Write(owner, operation))

describe('bulk request lifecycle', () => {
  let scope: ReturnType<typeof createMockRequestScope>
  beforeEach(() => {
    scope = createMockRequestScope({ matchMode: 'unordered' })
    BaseRequest.getDefaultClient().setBaseUrl('https://example.test')
  })
  afterEach(() => scope.dispose())

  it('bounds concurrent requests without breaking owner ordering or blocking independent owners', async () => {
    const first = deferredResponse()
    const independent = deferredResponse()
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(first.respond)
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a2' }).respond(jsonResponse(200, {}))
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/b1' }).respond(independent.respond)
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/c1' }).respond(jsonResponse(200, {}))
    const sender = new BulkRequestSender([wrap('a', 'a1'), wrap('a', 'a2'), wrap('b', 'b1'), wrap('c', 'c1')])
      .setConcurrencyLimit(2)
      .setScheduling({ keys: (wrapper) => [(wrapper.getRequest() as Write).owner] })
    const pending = sender.send()
    await vi.waitFor(() => expect(scope.driver.getHistory()).toHaveLength(2))
    expect(scope.driver.getHistory().map((entry) => entry.url)).toEqual(['https://example.test/a1', 'https://example.test/b1'])
    expect(() => sender.setConcurrencyLimit(1)).toThrow('while a batch is running')
    independent.resolve(jsonResponse(200, {}))
    await vi.waitFor(() => expect(scope.driver.getHistory()).toHaveLength(3))
    expect(scope.driver.getHistory()[2]!.url).toBe('https://example.test/c1')
    first.resolve(jsonResponse(200, {}))
    expect((await pending).getSuccessCount()).toBe(4)
    expect(scope.driver.getHistory()[3]!.url).toBe('https://example.test/a2')
  })

  it('cancels requests waiting for capacity without sending them', async () => {
    const first = deferredResponse()
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(first.respond)
    const requests = [wrap('a', 'a1'), wrap('b', 'b1')]
    const sender = new BulkRequestSender(requests).setConcurrencyLimit(1)
    const pending = sender.send()
    await vi.waitFor(() => expect(scope.driver.getHistory()).toHaveLength(1))
    sender.abort()
    expect((await pending).getCancelledCount()).toBe(2)
    expect(requests[1]!.wasSent()).toBe(false)
    expect(scope.driver.getHistory()).toHaveLength(1)
  })

  it.each([0, -1, 1.5, NaN])('rejects invalid concurrency %s', (limit) => {
    expect(() => new BulkRequestSender().setConcurrencyLimit(limit)).toThrow('Concurrency must be a positive integer')
  })

  it('serializes shared owners while independent requests proceed and waits for success processing', async () => {
    const deferred = deferredResponse()
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(deferred.respond)
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a2' }).respond(jsonResponse(200, {}))
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/b1' }).respond(jsonResponse(200, {}))
    const completed: string[] = []
    const sender = new BulkRequestSender([wrap('a', 'a1'), wrap('a', 'a2'), wrap('b', 'b1')]).setScheduling({
      keys: (wrapper) => [(wrapper.getRequest() as Write).owner],
      succeeded: async (wrapper) => {
        completed.push(wrapper.getRequest().url().toString())
      }
    })
    const pending = sender.send()
    await vi.waitFor(() => expect(completed).toEqual(['/b1']))
    expect(scope.driver.getHistory().map((entry) => entry.url)).toEqual(['https://example.test/a1', 'https://example.test/b1'])
    deferred.resolve(jsonResponse(200, {}))
    expect((await pending).getSuccessCount()).toBe(3)
    expect(completed).toEqual(['/b1', '/a1', '/a2'])
  })

  it('cancels all dependent owners after failure without counting unsent writes as successes', async () => {
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(jsonResponse(409, { message: 'stale' }))
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/c1' }).respond(jsonResponse(200, {}))
    const requests = [wrap('a', 'a1'), wrap('a,b', 'a2'), wrap('b', 'b1'), wrap('c', 'c1')]
    const sender = new BulkRequestSender(requests).setScheduling({ keys: (wrapper) => (wrapper.getRequest() as Write).owner.split(',') })
    const result = await sender.send()
    expect(requests.map((request) => request.getOutcome())).toEqual(['failed', 'cancelled', 'cancelled', 'succeeded'])
    expect(requests[1]!.wasSent()).toBe(false)
    expect(result.getSuccessCount()).toBe(1)
    expect(result.getErrorCount()).toBe(1)
    expect(result.getCancelledCount()).toBe(2)
  })

  it('resets errors on a successful explicitly eligible retry', async () => {
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(jsonResponse(503, { message: 'unavailable' }))
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(jsonResponse(200, { saved: true }))
    const wrapper = wrap('a', 'a1')
    const success = vi.fn()
    const sender = new BulkRequestSender([wrapper])
      .setRetryCount(1)
      .setRetryPolicy(() => true)
      .on(BulkRequestEventEnum.REQUEST_SUCCESSFUL, success)
    expect((await sender.send()).getSuccessCount()).toBe(1)
    expect(wrapper.hasError()).toBe(false)
    expect(wrapper.getError()).toBeNull()
    expect(success).toHaveBeenCalledOnce()
  })

  it.each([409, 412, 428])('retries status %s when the caller allows it', async (status) => {
    scope.driver
      .expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' })
      .respond(jsonResponse(status, { message: 'precondition' }))
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(jsonResponse(200, { saved: true }))
    const policy = vi.fn(() => true)
    const sender = new BulkRequestSender([wrap('a', 'a1')]).setRetryCount(1).setRetryPolicy(policy)
    const result = await sender.send()
    expect(result.getSuccessCount()).toBe(1)
    expect(result.getErrorCount()).toBe(0)
    expect(policy).toHaveBeenCalledExactlyOnceWith(expect.any(Error), 1)
    expect(scope.driver.getHistory()).toHaveLength(2)
  })

  it.each([409, 412, 428])('does not retry status %s when the caller rejects it', async (status) => {
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(jsonResponse(status, {}))
    const policy = vi.fn(() => false)
    const sender = new BulkRequestSender([wrap('a', 'a1')]).setRetryCount(3).setRetryPolicy(policy)
    expect((await sender.send()).getErrorCount()).toBe(1)
    expect(policy).toHaveBeenCalledExactlyOnceWith(expect.any(Error), 1)
    expect(scope.driver.getHistory()).toHaveLength(1)
  })

  it('bounds retries even when the policy always approves', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(jsonResponse(409, {}))
    }
    const policy = vi.fn(() => true)
    const sender = new BulkRequestSender([wrap('a', 'a1')]).setRetryCount(2).setRetryPolicy(policy)
    expect((await sender.send()).getErrorCount()).toBe(1)
    expect(policy.mock.calls).toEqual([
      [expect.any(Error), 1],
      [expect.any(Error), 2]
    ])
    expect(scope.driver.getHistory()).toHaveLength(3)
  })

  it('finishes retries before starting the next sequential operation', async () => {
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(jsonResponse(503, {}))
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(jsonResponse(200, {}))
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/b1' }).respond(jsonResponse(200, {}))
    const sender = new BulkRequestSender([wrap('a', 'a1'), wrap('b', 'b1')])
      .setExecutionMode(BulkRequestExecutionMode.SEQUENTIAL)
      .setRetryCount(1)
      .setRetryPolicy(() => true)
    expect((await sender.send()).getSuccessCount()).toBe(2)
    expect(scope.driver.getHistory().map(({ url }) => url)).toEqual(['https://example.test/a1', 'https://example.test/a1', 'https://example.test/b1'])
  })

  it('requires an explicit retry policy', async () => {
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(jsonResponse(503, {}))
    await new BulkRequestSender([wrap('a', 'a1')]).setRetryCount(3).send()
    expect(scope.driver.getHistory()).toHaveLength(1)
  })

  it('tracks loading through a deferred response and rejects replacing a running batch', async () => {
    const deferred = deferredResponse()
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(deferred.respond)
    const sender = new BulkRequestSender([wrap('a', 'a1')])
    expect(sender.isLoading).toBe(false)
    const pending = sender.send()
    expect(sender.isLoading).toBe(true)
    expect(() => sender.setRequests([])).toThrow()
    deferred.resolve(jsonResponse(200, { saved: true }))
    expect((await pending).getSuccessCount()).toBe(1)
    expect(sender.isLoading).toBe(false)
  })

  it('keeps previous results stable when the same wrappers are sent again', async () => {
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(jsonResponse(409, { message: 'changed' }))
    const sender = new BulkRequestSender([wrap('a', 'a1')])
    const failed = await sender.send()
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(jsonResponse(200, { saved: true }))
    const succeeded = await sender.send()
    expect(succeeded.getSuccessCount()).toBe(1)
    expect(succeeded.getFailedResponses()).toHaveLength(0)
    expect(failed.getErrorCount()).toBe(1)
    expect(failed.getSuccessCount()).toBe(0)
    expect(failed.getFailedResponses()).toHaveLength(1)
  })

  it('cancels active and queued operations without retrying', async () => {
    const deferred = deferredResponse()
    scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/a1' }).respond(deferred.respond)
    const requests = [wrap('a', 'a1'), wrap('a', 'a2')]
    const sender = new BulkRequestSender(requests)
      .setRetryCount(3)
      .setRetryPolicy(() => true)
      .setScheduling({ keys: () => ['a'] })
    const pending = sender.send()
    await vi.waitFor(() => expect(scope.driver.getHistory()).toHaveLength(1))
    sender.abort()
    const result = await pending
    expect(result.getCancelledCount()).toBe(2)
    expect(result.getSuccessCount()).toBe(0)
    expect(requests[1]!.wasSent()).toBe(false)
  })
})
