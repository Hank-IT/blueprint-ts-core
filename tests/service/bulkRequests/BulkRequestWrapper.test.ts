import { describe, expect, it, vi } from 'vitest'
import { BulkRequestWrapper } from '../../../src/bulkRequests/BulkRequestWrapper'

const createRequest = (behavior: { shouldFail?: boolean } = {}) => {
  return {
    send: vi.fn().mockImplementation(() => {
      if (behavior.shouldFail) {
        return Promise.reject(new Error('fail'))
      }
      return Promise.resolve('ok')
    }),
    isLoading: vi.fn().mockReturnValue(false),
    setAbortSignal: vi.fn(),
  }
}

describe('BulkRequestWrapper', () => {
  it('stores response on success', async () => {
    const request = createRequest()
    const wrapper = new BulkRequestWrapper(request as any)

    await wrapper.send()

    expect(wrapper.getResponse()).toBe('ok')
    expect(wrapper.getError()).toBeNull()
    expect(wrapper.hasError()).toBe(false)
    expect(wrapper.wasSent()).toBe(true)
  })

  it('stores error on failure', async () => {
    const request = createRequest({ shouldFail: true })
    const wrapper = new BulkRequestWrapper(request as any)

    await wrapper.send()

    expect(wrapper.getResponse()).toBeNull()
    expect(wrapper.getError()).toBeInstanceOf(Error)
    expect(wrapper.hasError()).toBe(true)
    expect(wrapper.wasSent()).toBe(true)
  })

  it('passes abort signal to request', async () => {
    const request = createRequest()
    const wrapper = new BulkRequestWrapper(request as any)
    const controller = new AbortController()

    await wrapper.send(controller.signal)

    expect(request.setAbortSignal).toHaveBeenCalledWith(controller.signal)
  })
})
