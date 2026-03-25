import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { XMLHttpRequestDriver } from '../../../../src/requests/drivers/xhr/XMLHttpRequestDriver'
import { XMLHttpRequestResponse } from '../../../../src/requests/drivers/xhr/XMLHttpRequestResponse'
import { RequestMethodEnum } from '../../../../src/requests/RequestMethod.enum'
import { ResponseException } from '../../../../src/requests/exceptions/ResponseException'
import type { BodyContent, BodyContract } from '../../../../src/requests/contracts/BodyContract'

const createBody = (content: BodyContent, headers: Record<string, string> = { 'Content-Type': 'application/json' }): BodyContract => ({
  getHeaders: () => headers,
  getContent: () => content,
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
      lengthComputable,
    } as ProgressEvent<EventTarget>)
  }
}

describe('XMLHttpRequestDriver', () => {
  const originalXMLHttpRequest = global.XMLHttpRequest

  beforeEach(() => {
    MockXMLHttpRequest.instances = []
    global.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest
  })

  afterEach(() => {
    global.XMLHttpRequest = originalXMLHttpRequest
    vi.restoreAllMocks()
  })

  it('sends requests with merged headers, body, and upload progress callbacks', async () => {
    const onUploadProgress = vi.fn()
    const driver = new XMLHttpRequestDriver({ headers: { 'X-Global': 'a' }, corsWithCredentials: true })

    const promise = driver.send(
      'https://example.com',
      RequestMethodEnum.POST,
      { 'X-Req': 'b', 'X-Fn': () => 'c', 'X-Ignore': undefined },
      createBody('{"name":"test"}'),
      { onUploadProgress }
    )

    const request = MockXMLHttpRequest.instances[0]
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
      'Content-Type': 'application/json',
    })
    expect(request.sentBody).toBe('{"name":"test"}')
    expect(onUploadProgress).toHaveBeenCalledWith({
      loaded: 5,
      total: 10,
      lengthComputable: true,
      progress: 0.5,
    })
    await expect(result.json()).resolves.toEqual({ ok: true })
  })

  it('omits body for GET and HEAD requests', async () => {
    const driver = new XMLHttpRequestDriver()

    const promise = driver.send('https://example.com', RequestMethodEnum.GET, {}, createBody('data'))

    const request = MockXMLHttpRequest.instances[0]
    request.triggerLoad()

    await promise

    expect(request.sentBody).toBeUndefined()
  })

  it('passes typed array bodies through to xhr unchanged', async () => {
    const driver = new XMLHttpRequestDriver()
    const chunk = new Uint8Array([1, 2, 3, 4])

    const promise = driver.send(
      'https://example.com',
      RequestMethodEnum.PUT,
      {},
      createBody(chunk, { 'Content-Type': 'application/octet-stream' })
    )

    const request = MockXMLHttpRequest.instances[0]
    request.triggerLoad()

    await promise

    expect(request.sentBody).toBe(chunk)
  })

  it('throws ResponseException when the response status is not ok', async () => {
    const driver = new XMLHttpRequestDriver()

    const promise = driver.send('https://example.com', RequestMethodEnum.GET, {})

    const request = MockXMLHttpRequest.instances[0]
    request.status = 500
    request.response = 'fail'
    request.triggerLoad()

    await expect(promise).rejects.toBeInstanceOf(ResponseException)
  })

  it('aborts requests when the AbortSignal is triggered', async () => {
    const controller = new AbortController()
    const driver = new XMLHttpRequestDriver()

    const promise = driver.send('https://example.com', RequestMethodEnum.POST, {}, createBody('{"name":"test"}'), {
      abortSignal: controller.signal,
    })

    const request = MockXMLHttpRequest.instances[0]
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(request.aborted).toBe(true)
  })
})
