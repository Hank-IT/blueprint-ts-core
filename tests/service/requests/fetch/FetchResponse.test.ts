import { describe, expect, it } from 'vitest'
import { FetchResponse } from '../../../../src/requests/drivers/fetch/FetchResponse'

describe('FetchResponse', () => {
  it('exposes response data', async () => {
    const response = new Response('{"name":"Ada"}', {
      status: 201,
      headers: { 'X-Test': 'yes' },
    })

    const fetchResponse = new FetchResponse(response)

    expect(fetchResponse.getStatusCode()).toBe(201)
    expect(fetchResponse.getHeaders()).toEqual({
      'content-type': 'text/plain;charset=UTF-8',
      'x-test': 'yes',
    })
    expect(fetchResponse.getRawResponse()).toBe(response)
    await expect(fetchResponse.json()).resolves.toEqual({ name: 'Ada' })
  })
})
