import { describe, expect, it } from 'vitest'
import { BaseResponse } from '../../../src/requests/responses/BaseResponse'
import { JsonResponse } from '../../../src/requests/responses/JsonResponse'
import { PlainTextResponse } from '../../../src/requests/responses/PlainTextResponse'
import { BlobResponse } from '../../../src/requests/responses/BlobResponse'
import type { ResponseHandlerContract } from '../../../src/requests/drivers/contracts/ResponseHandlerContract'

class TestResponse extends BaseResponse<string> {
  public getAcceptHeader(): string {
    return 'text/plain'
  }

  protected resolveBody(): Promise<string> {
    return Promise.resolve('ok')
  }
}

const mockResponseHandler: ResponseHandlerContract = {
  getStatusCode: () => 200,
  getHeaders: () => ({ 'x-test': 'yes' }),
  getRawResponse: () => new Response('raw'),
  json: async () => ({ ok: true }),
  text: async () => 'plain',
  blob: async () => new Blob(['blob'], { type: 'text/plain' }),
}

describe('Response classes', () => {
  it('BaseResponse throws if body not set', () => {
    const response = new TestResponse()

    expect(() => response.getBody()).toThrow('Response body is not set')
  })

  it('BaseResponse stores response metadata and body', async () => {
    const response = new TestResponse()

    await response.setResponse(mockResponseHandler)

    expect(response.getBody()).toBe('ok')
    expect(response.getStatusCode()).toBe(200)
    expect(response.getHeaders()).toEqual({ 'x-test': 'yes' })
    expect(response.getRawResponse()).toBeInstanceOf(Response)
  })

  it('JsonResponse resolves JSON body', async () => {
    const response = new JsonResponse<{ ok: boolean }>()

    await response.setResponse(mockResponseHandler)

    expect(response.getAcceptHeader()).toBe('application/json')
    expect(response.getBody()).toEqual({ ok: true })
  })

  it('PlainTextResponse resolves text body', async () => {
    const response = new PlainTextResponse()

    await response.setResponse(mockResponseHandler)

    expect(response.getAcceptHeader()).toBe('text/plain')
    expect(response.getBody()).toBe('plain')
  })

  it('BlobResponse resolves blob body and uses mime type', async () => {
    const response = new BlobResponse('application/pdf')

    await response.setResponse(mockResponseHandler)

    expect(response.getAcceptHeader()).toBe('application/pdf')
    expect(response.getBody()).toBeInstanceOf(Blob)
  })

  it('throws when resolveBody is called without a response', () => {
    const response = new JsonResponse()

    expect(() => (response as any).resolveBody()).toThrow('Response is not set')

    const plain = new PlainTextResponse()
    expect(() => (plain as any).resolveBody()).toThrow('Response is not set')

    const blob = new BlobResponse()
    expect(() => (blob as any).resolveBody()).toThrow('Response is not set')
  })
})
