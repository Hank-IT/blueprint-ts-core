import { describe, expect, it, vi } from 'vitest'
import { BulkRequestSender, BulkRequestExecutionMode } from '../../../src/bulkRequests/BulkRequestSender'
import { BulkRequestWrapper } from '../../../src/bulkRequests/BulkRequestWrapper'
import { BulkRequestEventEnum } from '../../../src/bulkRequests/BulkRequestEvent.enum'

const createRequest = (options: { failTimes?: number } = {}) => {
  let calls = 0

  return {
    send: vi.fn().mockImplementation(() => {
      calls += 1
      if (options.failTimes && calls <= options.failTimes) {
        return Promise.reject(new Error('fail'))
      }
      return Promise.resolve('ok')
    }),
    isLoading: vi.fn().mockReturnValue(false),
    setAbortSignal: vi.fn(),
  }
}

describe('BulkRequestSender', () => {
  it('sends requests in parallel and emits success events', async () => {
    const wrappers = [new BulkRequestWrapper(createRequest() as any), new BulkRequestWrapper(createRequest() as any)]

    const sender = new BulkRequestSender(wrappers, BulkRequestExecutionMode.PARALLEL)
    const onSuccess = vi.fn()

    sender.on(BulkRequestEventEnum.REQUEST_SUCCESSFUL, onSuccess)

    const result = await sender.send()

    expect(onSuccess).toHaveBeenCalledTimes(2)
    expect(result.getSuccessCount()).toBe(2)
    expect(result.getErrorCount()).toBe(0)
    expect(result.getSuccessfulResponses()).toEqual(['ok', 'ok'])
  })

  it('retries failed requests and emits failure events when still failing', async () => {
    const failingRequest = createRequest({ failTimes: 2 })
    const wrapper = new BulkRequestWrapper(failingRequest as any)

    const sender = new BulkRequestSender([wrapper], BulkRequestExecutionMode.SEQUENTIAL, 1)
    const onFailed = vi.fn()

    sender.on(BulkRequestEventEnum.REQUEST_FAILED, onFailed)

    await sender.send()

    expect(failingRequest.send).toHaveBeenCalledTimes(2)
    expect(onFailed).toHaveBeenCalledTimes(1)
  })

  it('reports loading state when any request is loading', () => {
    const request1 = createRequest()
    const request2 = createRequest()
    request2.isLoading = vi.fn().mockReturnValue(true)

    const sender = new BulkRequestSender(
      [new BulkRequestWrapper(request1 as any), new BulkRequestWrapper(request2 as any)],
      BulkRequestExecutionMode.PARALLEL
    )

    expect(sender.isLoading).toBe(true)
  })

  it('removes event handlers with off()', () => {
    const sender = new BulkRequestSender([], BulkRequestExecutionMode.PARALLEL)
    const handler = vi.fn()

    sender.on(BulkRequestEventEnum.REQUEST_SUCCESSFUL, handler)
    sender.off(BulkRequestEventEnum.REQUEST_SUCCESSFUL)

    expect((sender as any).events.has(BulkRequestEventEnum.REQUEST_SUCCESSFUL)).toBe(false)
  })
})
