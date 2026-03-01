import { describe, expect, it } from 'vitest'
import { ResponseException } from '../../../../src/requests/exceptions/ResponseException'
import { ResponseBodyException } from '../../../../src/requests/exceptions/ResponseBodyException'
import { BadRequestException } from '../../../../src/requests/exceptions/BadRequestException'
import { StaleResponseException } from '../../../../src/requests/exceptions/StaleResponseException'

const mockResponse = {
  getStatusCode: () => 400,
  getHeaders: () => ({}),
  getRawResponse: () => new Response(),
  json: async () => ({}),
  text: async () => '',
  blob: async () => new Blob(),
}

describe('Request exceptions', () => {
  it('ResponseException stores response', () => {
    const exception = new ResponseException(mockResponse as any)

    expect(exception.getResponse()).toBe(mockResponse)
  })

  it('ResponseBodyException stores response and body', () => {
    const exception = new ResponseBodyException(mockResponse as any, { error: 'bad' })

    expect(exception.getResponse()).toBe(mockResponse)
    expect(exception.getBody()).toEqual({ error: 'bad' })
  })

  it('BadRequestException extends ResponseBodyException', () => {
    const exception = new BadRequestException(mockResponse as any, { error: 'bad' })

    expect(exception).toBeInstanceOf(ResponseBodyException)
  })

  it('StaleResponseException exposes cause', () => {
    const cause = new Error('root')
    const exception = new StaleResponseException('stale', cause)

    expect(exception.message).toBe('stale')
    expect(exception.getCause()).toBe(cause)
  })
})
