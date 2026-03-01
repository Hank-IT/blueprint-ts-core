import { describe, expect, it, vi } from 'vitest'
import { RequestErrorRouter } from '../../../src/requests/RequestErrorRouter'
import { BadRequestException } from '../../../src/requests/exceptions/BadRequestException'

const mockResponse = {
  getStatusCode: () => 400,
  getHeaders: () => ({}),
  getRawResponse: () => new Response(),
  json: async () => ({}),
  text: async () => '',
  blob: async () => new Blob(),
}

describe('RequestErrorRouter', () => {
  it('routes known errors to handlers', async () => {
    const router = new RequestErrorRouter()
    const handler = vi.fn()

    router.on(BadRequestException, handler)

    const handled = await router.handle(new BadRequestException(mockResponse as any, { message: 'bad' }))

    expect(handled).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('uses default handler when no match found', async () => {
    const router = new RequestErrorRouter()
    const fallback = vi.fn()

    router.otherwise(fallback)

    const handled = await router.handle(new Error('other'))

    expect(handled).toBe(true)
    expect(fallback).toHaveBeenCalledTimes(1)
  })

  it('returns false when no handlers are registered', async () => {
    const router = new RequestErrorRouter()

    await expect(router.handle(new Error('nope'))).resolves.toBe(false)
  })
})
