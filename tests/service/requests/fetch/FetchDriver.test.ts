import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FetchDriver } from '../../../../src/requests/drivers/fetch/FetchDriver'
import { FetchResponse } from '../../../../src/requests/drivers/fetch/FetchResponse'
import { RequestMethodEnum } from '../../../../src/requests/RequestMethod.enum'
import { ResponseException } from '../../../../src/requests/exceptions/ResponseException'
import type { BodyContract } from '../../../../src/requests/contracts/BodyContract'

const createBody = (content: string): BodyContract => ({
  getHeaders: () => ({ 'Content-Type': 'application/json' }),
  getContent: () => content,
})

describe('FetchDriver', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('sends requests with merged headers and body', async () => {
    const response = new Response('{"ok":true}', {
      status: 200,
      headers: { 'X-Response': 'yes' },
    })

    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(response)

    const driver = new FetchDriver({ headers: { 'X-Global': 'a' }, corsWithCredentials: true })

    const result = await driver.send(
      'https://example.com',
      RequestMethodEnum.POST,
      { 'X-Req': 'b', 'X-Fn': () => 'c', 'X-Ignore': undefined },
      createBody('{"name":"test"}')
    )

    expect(result).toBeInstanceOf(FetchResponse)

    const [, config] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(config.method).toBe('POST')
    expect(config.credentials).toBe('include')
    expect(config.headers).toEqual({
      'X-Global': 'a',
      'X-Req': 'b',
      'X-Fn': 'c',
      'Content-Type': 'application/json',
    })
    expect(config.body).toBe('{"name":"test"}')
  })

  it('omits body for GET/HEAD requests', async () => {
    const response = new Response('ok', { status: 200 })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(response)

    const driver = new FetchDriver()

    await driver.send('https://example.com', RequestMethodEnum.GET, {}, createBody('data'))

    const [, config] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(config.body).toBeUndefined()
  })

  it('throws ResponseException when response is not ok', async () => {
    const response = new Response('fail', { status: 500 })
    ;(global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(response)

    const driver = new FetchDriver()

    await expect(driver.send('https://example.com', RequestMethodEnum.GET, {})).rejects.toBeInstanceOf(ResponseException)
  })
})
