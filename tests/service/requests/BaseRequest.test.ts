import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseRequest } from '../../../src/requests/BaseRequest'
import { BaseResponse } from '../../../src/requests/responses/BaseResponse'
import { JsonBodyFactory } from '../../../src/requests/factories/JsonBodyFactory'
import { RequestMethodEnum } from '../../../src/requests/RequestMethod.enum'
import { RequestEvents } from '../../../src/requests/RequestEvents.enum'
import { RequestConcurrencyMode } from '../../../src/requests/RequestConcurrencyMode.enum'
import { StaleResponseException } from '../../../src/requests/exceptions/StaleResponseException'
import { ResponseException } from '../../../src/requests/exceptions/ResponseException'
import { ErrorHandler } from '../../../src/requests/ErrorHandler'
import type { RequestDriverContract } from '../../../src/requests/contracts/RequestDriverContract'
import type { RequestLoaderContract } from '../../../src/requests/contracts/RequestLoaderContract'
import type { RequestLoaderFactoryContract } from '../../../src/requests/contracts/RequestLoaderFactoryContract'
import type { ResponseHandlerContract } from '../../../src/requests/drivers/contracts/ResponseHandlerContract'

class TestResponse extends BaseResponse<string> {
  public getAcceptHeader(): string {
    return 'text/plain'
  }

  protected resolveBody(): Promise<string> {
    return Promise.resolve('ok')
  }
}

class TestLoader implements RequestLoaderContract<boolean> {
  private loading = false

  isLoading(): boolean {
    return this.loading
  }

  setLoading(value: boolean): void {
    this.loading = value
  }
}

class TestRequest extends BaseRequest<boolean, { message: string }, string, TestResponse, { name: string }, { filter?: { active?: boolean } }> {
  public method(): RequestMethodEnum {
    return RequestMethodEnum.POST
  }

  public url(): string {
    return '/test'
  }

  public getResponse(): TestResponse {
    return new TestResponse()
  }

  public requestHeaders() {
    return { 'X-Req': 'value' }
  }

  public getRequestBodyFactory() {
    return new JsonBodyFactory<{ name: string }>()
  }
}

const createResponseHandler = (): ResponseHandlerContract => ({
  getStatusCode: () => 200,
  getHeaders: () => ({}),
  getRawResponse: () => new Response('ok'),
  json: async () => ({ ok: true }),
  text: async () => 'ok',
  blob: async () => new Blob(),
})

describe('BaseRequest', () => {
  beforeEach(() => {
    BaseRequest.setDefaultBaseUrl('https://example.com')
    BaseRequest.setRequestLoaderFactory(undefined as unknown as RequestLoaderFactoryContract<boolean>)
    BaseRequest.setRequestDriver(undefined as unknown as RequestDriverContract)
  })

  it('builds URLs with params and merges params deeply', () => {
    const request = new TestRequest()

    request.setParams({ filter: { active: true } })
    request.withParams({ filter: { active: false } })

    expect(request.getParams()).toEqual({ filter: { active: false } })

    const url = request.buildUrl()
    expect(url.toString()).toBe('https://example.com/test?filter%5Bactive%5D=false')
  })

  it('dispatches loading events and toggles loader', async () => {
    const loaderFactory: RequestLoaderFactoryContract<boolean> = {
      make: () => new TestLoader(),
    }

    BaseRequest.setRequestLoaderFactory(loaderFactory)

    const driver: RequestDriverContract = {
      send: vi.fn().mockResolvedValue(createResponseHandler()),
    }
    BaseRequest.setRequestDriver(driver)

    const request = new TestRequest()
    const loadingEvents: boolean[] = []

    request.on(RequestEvents.LOADING, (value: boolean) => loadingEvents.push(value))
    request.setBody({ name: 'Ada' })

    const response = await request.send()

    expect(response.getBody()).toBe('ok')
    expect(loadingEvents).toEqual([true, false])
    expect(request.isLoading()).toBe(false)

    expect(driver.send).toHaveBeenCalledTimes(1)

    const [url, method, headers, body] = (driver.send as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url.toString()).toBe('https://example.com/test')
    expect(method).toBe(RequestMethodEnum.POST)
    expect(headers).toEqual({ Accept: 'text/plain', 'X-Req': 'value' })
    expect(body?.getContent()).toBe('{"name":"Ada"}')
  })

  it('can send without resolving the typed response body', async () => {
    const responseHandler = createResponseHandler()
    const driver: RequestDriverContract = {
      send: vi.fn().mockResolvedValue(responseHandler),
    }
    BaseRequest.setRequestDriver(driver)

    const request = new TestRequest()
    request.setBody({ name: 'Ada' })

    request.setHeaders({ Accept: 'application/json' })

    const response = await request.send({ resolveBody: false })

    expect(response).toBe(responseHandler)

    const [, , headers] = (driver.send as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(headers).toEqual({ Accept: 'application/json', 'X-Req': 'value' })
  })

  it('dispatches upload progress events from the driver config callback', async () => {
    const driver: RequestDriverContract = {
      send: vi.fn().mockImplementation(async (_url, _method, _headers, _body, requestConfig) => {
        requestConfig?.onUploadProgress?.({
          loaded: 5,
          total: 10,
          lengthComputable: true,
          progress: 0.5,
        })

        return createResponseHandler()
      }),
    }

    BaseRequest.setRequestDriver(driver)

    const request = new TestRequest()
    const progressEvents: Array<number | undefined> = []

    request.on(RequestEvents.UPLOAD_PROGRESS, (value: { progress?: number }) => progressEvents.push(value.progress))
    request.setBody({ name: 'Ada' })

    await request.send()

    expect(progressEvents).toEqual([0.5])
  })

  it('throws when loading state is requested without a loader', () => {
    const request = new TestRequest()

    expect(() => request.isLoading()).toThrow('Request loader is not set.')
  })

  it('marks stale responses when using LATEST concurrency mode', async () => {
    const driver: RequestDriverContract = {
      send: vi.fn(),
    }
    BaseRequest.setRequestDriver(driver)

    const resolvers: Array<(value: ResponseHandlerContract) => void> = []

    ;(driver.send as ReturnType<typeof vi.fn>).mockImplementation(() =>
      new Promise<ResponseHandlerContract>((resolve) => {
        resolvers.push(resolve)
      })
    )

    const request = new TestRequest()
    request.setConcurrency({ mode: RequestConcurrencyMode.LATEST, key: 'latest-test' })

    const first = request.send()
    const second = request.send()

    resolvers[1](createResponseHandler())
    await expect(second).resolves.toBeInstanceOf(TestResponse)

    resolvers[0](createResponseHandler())
    await expect(first).rejects.toBeInstanceOf(StaleResponseException)
  })

  it('aborts previous request when using REPLACE mode', async () => {
    const driver: RequestDriverContract = {
      send: vi.fn(),
    }
    BaseRequest.setRequestDriver(driver)

    const request = new TestRequest()
    request.setConcurrency({ mode: RequestConcurrencyMode.REPLACE, key: 'replace-test' })

    const resolvers: Array<(value: ResponseHandlerContract) => void> = []
    ;(driver.send as ReturnType<typeof vi.fn>).mockImplementation(() =>
      new Promise<ResponseHandlerContract>((resolve) => {
        resolvers.push(resolve)
      })
    )

    const firstPromise = request.send()
    const firstConfig = (driver.send as ReturnType<typeof vi.fn>).mock.calls[0][4]

    const secondPromise = request.send()

    expect(firstConfig?.abortSignal?.aborted).toBe(true)

    resolvers[0](createResponseHandler())
    resolvers[1](createResponseHandler())

    await Promise.allSettled([firstPromise, secondPromise])
  })

  it('invokes ErrorHandler when a ResponseException is thrown', async () => {
    const responseHandler = createResponseHandler()
    const responseException = new ResponseException(responseHandler)

    const driver: RequestDriverContract = {
      send: vi.fn().mockRejectedValue(responseException),
    }
    BaseRequest.setRequestDriver(driver)

    const handleSpy = vi.spyOn(ErrorHandler.prototype, 'handle').mockResolvedValue(undefined as never)

    const request = new TestRequest()

    await expect(request.send()).rejects.toBe(responseException)
    expect(handleSpy).toHaveBeenCalledTimes(1)
  })

  it('uses a request-defined driver when provided', async () => {
    const globalDriver: RequestDriverContract = {
      send: vi.fn().mockResolvedValue(createResponseHandler()),
    }
    const requestDriver: RequestDriverContract = {
      send: vi.fn().mockResolvedValue(createResponseHandler()),
    }

    BaseRequest.setRequestDriver(globalDriver)

    class DriverSpecificRequest extends TestRequest {
      protected override getRequestDriver(): RequestDriverContract {
        return requestDriver
      }
    }

    const request = new DriverSpecificRequest()

    await request.send()

    expect(requestDriver.send).toHaveBeenCalledTimes(1)
    expect(globalDriver.send).not.toHaveBeenCalled()
  })
})
