import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { XMLHttpRequestDriver } from '../../../../src/requests/drivers/xhr/XMLHttpRequestDriver'
import { XMLHttpRequestResponse } from '../../../../src/requests/drivers/xhr/XMLHttpRequestResponse'
import { RequestMethodEnum } from '../../../../src/requests/RequestMethod.enum'
import { ResponseException } from '../../../../src/requests/exceptions/ResponseException'
import type { BodyContent, BodyContract } from '../../../../src/requests/contracts/BodyContract'

const createBody = (content: BodyContent, headers: Record<string, string> = { 'Content-Type': 'application/json' }): BodyContract => ({
  getHeaders: () => headers,
  getContent: () => content
})

class MockXMLHttpRequestUpload {
  public onprogress: ((event: ProgressEvent<EventTarget>) => void) | null = null
}

class MockXMLHttpRequest {
  public static instances: MockXMLHttpRequest[] = []

  public method?: string
  public url?: string
  public async?: boolean
  public responseType: XMLHttpRequestResponseType = ''
  public withCredentials = false
  public status = 200
  public statusText = 'OK'
  public response: Blob | string | ArrayBuffer | null = '{"ok":true}'
  public onload: (() => void) | null = null
  public onerror: (() => void) | null = null
  public onabort: (() => void) | null = null
  public upload = new MockXMLHttpRequestUpload()
  public headers: Record<string, string> = {}
  public responseHeaders: Record<string, string> = {}
  public sentBody: Document | XMLHttpRequestBodyInit | null | undefined = undefined
  public aborted = false
  public sendCalls = 0

  public constructor() {
    MockXMLHttpRequest.instances.push(this)
  }

  public open(method: string, url: string, async: boolean): void {
    this.method = method
    this.url = url
    this.async = async
  }

  public setRequestHeader(key: string, value: string): void {
    this.headers[key] = value
  }

  public send(body?: Document | XMLHttpRequestBodyInit | null): void {
    this.sendCalls++
    this.sentBody = body
  }

  public abort(): void {
    this.aborted = true
    this.onabort?.()
  }

  public getAllResponseHeaders(): string {
    return Object.entries(this.responseHeaders)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n')
  }

  public triggerLoad(): void {
    this.onload?.()
  }

  public triggerError(): void {
    this.onerror?.()
  }

  public triggerUploadProgress(loaded: number, total: number, lengthComputable: boolean = true): void {
    this.upload.onprogress?.({
      loaded,
      total,
      lengthComputable
    } as ProgressEvent<EventTarget>)
  }
}

describe('XMLHttpRequestDriver', () => {
  const originalXMLHttpRequest = globalThis.XMLHttpRequest

  beforeEach(() => {
    MockXMLHttpRequest.instances = []
    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest
  })

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXMLHttpRequest
    vi.restoreAllMocks()
  })

  it('sends requests with merged headers, body, and upload progress callbacks', async () => {
    const onUploadProgress = vi.fn()
    const driver = new XMLHttpRequestDriver({ headers: { 'X-Global': 'a' }, corsWithCredentials: true })

    const promise = driver.send('https://example.com', RequestMethodEnum.POST, { 'X-Req': 'b', 'X-Fn': () => 'c' }, createBody('{"name":"test"}'), {
      onUploadProgress
    })

    const request = MockXMLHttpRequest.instances[0]!
    request.status = 201
    request.responseHeaders = { 'X-Response': 'yes' }
    request.triggerUploadProgress(5, 10)
    request.triggerLoad()

    const result = await promise

    expect(result).toBeInstanceOf(XMLHttpRequestResponse)
    expect(request.method).toBe('POST')
    expect(request.url).toBe('https://example.com')
    expect(request.async).toBe(true)
    expect(request.responseType).toBe('blob')
    expect(request.withCredentials).toBe(true)
    expect(request.headers).toEqual({
      'X-Global': 'a',
      'X-Req': 'b',
      'X-Fn': 'c',
      'Content-Type': 'application/json'
    })
    expect(request.sentBody).toBe('{"name":"test"}')
    expect(onUploadProgress).toHaveBeenCalledWith({
      loaded: 5,
      total: 10,
      lengthComputable: true,
      progress: 0.5
    })
    expect(result.getHeaders()).toEqual({ 'X-Response': 'yes' })
    expect(result.getRawResponse().headers.get('X-Response')).toBe('yes')
    await expect(result.json()).resolves.toEqual({ ok: true })
  })

  it.each([RequestMethodEnum.GET, RequestMethodEnum.HEAD])('omits the body for %s requests', async (method) => {
    const driver = new XMLHttpRequestDriver()

    const promise = driver.send('https://example.com', method, {}, createBody('data'))

    const request = MockXMLHttpRequest.instances[0]!
    request.triggerLoad()

    await promise

    expect(request.sentBody).toBeUndefined()
    expect(request.sendCalls).toBe(1)
  })

  it('passes typed array bodies through to xhr unchanged', async () => {
    const driver = new XMLHttpRequestDriver()
    const chunk = new Uint8Array([1, 2, 3, 4])

    const promise = driver.send('https://example.com', RequestMethodEnum.PUT, {}, createBody(chunk, { 'Content-Type': 'application/octet-stream' }))

    const request = MockXMLHttpRequest.instances[0]!
    request.triggerLoad()

    await promise

    expect(request.sentBody).toBe(chunk)
  })

  it('throws ResponseException when the response status is not ok', async () => {
    const driver = new XMLHttpRequestDriver()

    const promise = driver.send('https://example.com', RequestMethodEnum.GET, {})

    const request = MockXMLHttpRequest.instances[0]!
    request.status = 500
    request.response = 'fail'
    request.triggerLoad()

    await expect(promise).rejects.toBeInstanceOf(ResponseException)
  })

  it('aborts requests when the AbortSignal is triggered', async () => {
    const controller = new AbortController()
    const driver = new XMLHttpRequestDriver()

    const promise = driver.send('https://example.com', RequestMethodEnum.POST, {}, createBody('{"name":"test"}'), {
      abortSignal: controller.signal
    })

    const request = MockXMLHttpRequest.instances[0]!
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(request.aborted).toBe(true)
  })

  it.each([
    ['network error', 'Network request failed.'],
    ['status zero', 'No response received.']
  ])('rejects a %s and releases every callback and abort listener', async (failure, message) => {
    const controller = new AbortController()
    const driver = new XMLHttpRequestDriver()
    const pending = driver.send('https://example.com', RequestMethodEnum.GET, {}, undefined, { abortSignal: controller.signal })
    const request = MockXMLHttpRequest.instances[0]!
    if (failure === 'network error') request.triggerError()
    else {
      request.status = 0
      request.triggerLoad()
    }
    await expect(pending).rejects.toThrow(message)
    expect(request.onload).toBeNull()
    expect(request.onerror).toBeNull()
    expect(request.onabort).toBeNull()
    expect(request.upload.onprogress).toBeNull()
    controller.abort()
    expect(request.aborted).toBe(false)
  })

  it('does not send when the signal was aborted before the request started', async () => {
    const controller = new AbortController()
    controller.abort()
    const driver = new XMLHttpRequestDriver()
    await expect(
      driver.send('https://example.com', RequestMethodEnum.POST, {}, createBody('payload'), {
        abortSignal: controller.signal
      })
    ).rejects.toMatchObject({ name: 'AbortError' })
    const request = MockXMLHttpRequest.instances[0]!
    expect(request.sendCalls).toBe(0)
    expect(request.aborted).toBe(true)
    expect(request.onload).toBeNull()
    expect(request.upload.onprogress).toBeNull()
  })

  it('releases callbacks and the abort listener when xhr.send throws synchronously', async () => {
    const error = new Error('Body could not be sent')
    vi.spyOn(MockXMLHttpRequest.prototype, 'send').mockImplementationOnce(() => {
      throw error
    })
    const controller = new AbortController()
    const driver = new XMLHttpRequestDriver()
    await expect(
      driver.send('https://example.com', RequestMethodEnum.POST, {}, createBody('payload'), {
        abortSignal: controller.signal
      })
    ).rejects.toBe(error)
    const request = MockXMLHttpRequest.instances[0]!
    expect(request.onload).toBeNull()
    expect(request.onerror).toBeNull()
    expect(request.onabort).toBeNull()
    expect(request.upload.onprogress).toBeNull()
    controller.abort()
    expect(request.aborted).toBe(false)
  })

  it.each([
    { total: 10, lengthComputable: false, expectedTotal: undefined },
    { total: 0, lengthComputable: true, expectedTotal: 0 }
  ])('keeps progress undefined for total=$total and lengthComputable=$lengthComputable', async ({ total, lengthComputable, expectedTotal }) => {
    const onUploadProgress = vi.fn()
    const driver = new XMLHttpRequestDriver({ corsWithCredentials: true })
    const pending = driver.send(new URL('https://example.com/upload'), RequestMethodEnum.POST, {}, createBody('payload'), {
      corsWithCredentials: false,
      onUploadProgress
    })
    const request = MockXMLHttpRequest.instances[0]!
    request.triggerUploadProgress(5, total, lengthComputable)
    request.triggerLoad()
    await pending
    expect(onUploadProgress).toHaveBeenCalledExactlyOnceWith({ loaded: 5, total: expectedTotal, lengthComputable, progress: undefined })
    expect(request.url).toBe('https://example.com/upload')
    expect(request.withCredentials).toBe(false)
    expect(request.upload.onprogress).toBeNull()
  })
})
