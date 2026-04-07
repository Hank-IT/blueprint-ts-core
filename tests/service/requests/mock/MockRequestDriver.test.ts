import { beforeEach, describe, expect, it } from 'vitest'
import {
  BaseRequest,
  ErrorHandler,
  JsonBodyFactory,
  JsonResponse,
  MockRequestAssertionError,
  MockRequestDriver,
  PlainTextResponse,
  RequestMethodEnum,
  emptyResponse,
  expectJsonBody,
  getMockRequestJsonBody,
  getMockRequestQuery,
  getMockRequestTextBody,
  installMockRequestDriver,
  jsonResponse,
  matchHeaders,
  matchQuery,
  resetMockRequestDriver,
  validationError,
} from '../../../../src/requests'
import { ValidationException } from '../../../../src/requests/exceptions/ValidationException'
import type { BodyContent, BodyContract } from '../../../../src/requests/contracts/BodyContract'

const createBody = (content: BodyContent, headers: Record<string, string> = { 'Content-Type': 'application/json' }): BodyContract => ({
  getHeaders: () => headers,
  getContent: () => content,
})

class MockJsonRequest extends BaseRequest<
  boolean,
  { message: string, errors?: Record<string, string[]> },
  { ok: boolean },
  JsonResponse<{ ok: boolean }>,
  { name: string, role?: string },
  { filter?: string }
> {
  public method(): RequestMethodEnum {
    return RequestMethodEnum.POST
  }

  public url(): string {
    return '/mock'
  }

  public getResponse(): JsonResponse<{ ok: boolean }> {
    return new JsonResponse<{ ok: boolean }>()
  }

  public requestHeaders() {
    return { 'X-Request': 'blueprint', 'X-Optional': 'present' }
  }

  public getRequestBodyFactory() {
    return new JsonBodyFactory<{ name: string, role?: string }>()
  }
}

class MockTextRequest extends BaseRequest<boolean, { message: string }, string, PlainTextResponse, undefined> {
  public method(): RequestMethodEnum {
    return RequestMethodEnum.GET
  }

  public url(): string {
    return '/text'
  }

  public getResponse(): PlainTextResponse {
    return new PlainTextResponse()
  }
}

describe('MockRequestDriver', () => {
  beforeEach(() => {
    BaseRequest.setDefaultBaseUrl('https://example.com')
    ErrorHandler.registerHandler(undefined)
    resetMockRequestDriver()
  })

  it('keeps ordered exact matching as the default', async () => {
    const driver = new MockRequestDriver()
      .expect({
        method: RequestMethodEnum.POST,
        url: 'https://example.com/mock?filter=active',
        headers: {
          Accept: 'application/json',
          'X-Request': 'blueprint',
          'X-Optional': 'present',
          'Content-Type': 'application/json',
        },
        body: {
          name: 'Ada',
        },
        response: jsonResponse(200, { ok: true }),
      })

    BaseRequest.setRequestDriver(driver)

    const response = await new MockJsonRequest()
      .setParams({ filter: 'active' })
      .setBody({ name: 'Ada' })
      .send()

    expect(response.getBody()).toEqual({ ok: true })
    expect(getMockRequestJsonBody(driver.getHistory()[0])).toEqual({ name: 'Ada' })
    expect(() => driver.assertExpectationsMet()).not.toThrow()
  })

  it('supports unordered matching when configured', async () => {
    const driver = new MockRequestDriver(undefined, [], { matchMode: 'unordered' })
      .expect({
        method: RequestMethodEnum.GET,
        url: 'https://example.com/text',
        response: {
          status: 200,
          body: 'first',
        },
      })
      .expect({
        method: RequestMethodEnum.POST,
        url: 'https://example.com/mock',
        body: { name: 'Ada' },
        response: jsonResponse(200, { ok: true }),
      })

    BaseRequest.setRequestDriver(driver)

    const jsonResponseResult = await new MockJsonRequest()
      .setBody({ name: 'Ada' })
      .send()

    const textResponseResult = await new MockTextRequest().send({ resolveBody: false })

    expect(jsonResponseResult.getBody()).toEqual({ ok: true })
    await expect(textResponseResult.text()).resolves.toBe('first')
    expect(driver.getHistory()).toHaveLength(2)
    expect(() => driver.assertExpectationsMet()).not.toThrow()
  })

  it('supports fluent capture with predicate helpers for headers, query, and partial JSON bodies', async () => {
    const driver = installMockRequestDriver({ matchMode: 'unordered' })

    driver
      .expectAny({
        method: RequestMethodEnum.POST,
        url: 'https://example.com/mock',
      })
      .withHeaders(matchHeaders({
        Accept: 'application/json',
        'X-Request': 'blueprint',
      }))
      .withQuery(matchQuery({ filter: 'active' }))
      .withBody(expectJsonBody({ name: 'Ada' }, { partial: true }))
      .respond(jsonResponse(200, { ok: true }))

    const response = await new MockJsonRequest()
      .setParams({ filter: 'active' })
      .setBody({ name: 'Ada', role: 'admin' })
      .send()

    const history = driver.getHistory()

    expect(response.getBody()).toEqual({ ok: true })
    expect(getMockRequestJsonBody(history[0])).toEqual({ name: 'Ada', role: 'admin' })
    expect(getMockRequestQuery(history[0])).toEqual({ filter: 'active' })
    expect(() => driver.assertExpectationsMet()).not.toThrow()
  })

  it('matches exact headers regardless of object key order', async () => {
    const driver = new MockRequestDriver()
      .expect({
        method: RequestMethodEnum.POST,
        url: 'https://example.com/mock',
        headers: {
          Accept: 'application/json',
          'X-Optional': 'present',
          'X-Request': 'blueprint',
          'Content-Type': 'application/json',
        },
        body: {
          name: 'Ada',
        },
        response: jsonResponse(200, { ok: true }),
      })

    await expect(
      driver.send(
        'https://example.com/mock',
        RequestMethodEnum.POST,
        {
          'Content-Type': 'application/json',
          'X-Request': 'blueprint',
          Accept: 'application/json',
          'X-Optional': 'present',
        },
        createBody('{"name":"Ada"}')
      )
    ).resolves.toBeDefined()

    expect(() => driver.assertExpectationsMet()).not.toThrow()
  })

  it('matches exact query parameters regardless of object key order', async () => {
    const driver = new MockRequestDriver()
      .expect({
        method: RequestMethodEnum.GET,
        url: 'https://example.com/text',
        query: {
          second: '2',
          first: '1',
        },
        response: {
          status: 200,
          body: 'done',
        },
      })

    await expect(
      driver.send('https://example.com/text?first=1&second=2', RequestMethodEnum.GET, {})
    ).resolves.toBeDefined()

    expect(() => driver.assertExpectationsMet()).not.toThrow()
  })

  it('supports capture-first assertions without predefining the full request body', async () => {
    const driver = new MockRequestDriver()

    driver
      .expectAny({
        method: RequestMethodEnum.POST,
        url: 'https://example.com/mock',
      })
      .respond(emptyResponse())

    BaseRequest.setRequestDriver(driver)

    await new MockJsonRequest()
      .setBody({ name: 'Ada', role: 'admin' })
      .send({ resolveBody: false })

    expect(getMockRequestJsonBody(driver.getHistory()[0])).toEqual({ name: 'Ada', role: 'admin' })
    expect(() => driver.assertExpectationsMet()).not.toThrow()
  })

  it('exposes text body helpers for history assertions', async () => {
    const driver = new MockRequestDriver()
      .expect({
        method: RequestMethodEnum.PUT,
        url: 'https://example.com/text-body',
        body: 'plain-text',
        response: emptyResponse(),
      })

    await driver.send(
      'https://example.com/text-body',
      RequestMethodEnum.PUT,
      {},
      createBody('plain-text', { 'Content-Type': 'text/plain' })
    )

    expect(getMockRequestTextBody(driver.getHistory()[0])).toBe('plain-text')
  })

  it('uses convenience response builders for error responses', async () => {
    const driver = new MockRequestDriver()
      .expect({
        method: RequestMethodEnum.POST,
        url: 'https://example.com/mock',
        body: {
          name: '',
        },
        response: validationError({
          name: ['Required'],
        }, 'Validation failed'),
      })

    BaseRequest.setRequestDriver(driver)

    await expect(
      new MockJsonRequest()
        .setBody({ name: '' })
        .send()
    ).rejects.toBeInstanceOf(ValidationException)

    expect(() => driver.assertExpectationsMet()).not.toThrow()
  })

  it('provides a clean install and reset helper for global setup', async () => {
    const driver = installMockRequestDriver()

    driver.expect({
      method: RequestMethodEnum.GET,
      url: 'https://example.com/text',
      response: {
        status: 200,
        body: 'done',
      },
    })

    const response = await new MockTextRequest().send({ resolveBody: false })

    await expect(response.text()).resolves.toBe('done')
    expect(driver.getHistory()).toHaveLength(1)

    const resetDriver = resetMockRequestDriver()

    expect(resetDriver).toBe(driver)
    expect(driver.getHistory()).toEqual([])
    expect(() => driver.assertExpectationsMet()).not.toThrow()
  })

  it('reinstalls the remembered mock globally when reset is called after driver drift', async () => {
    const driver = installMockRequestDriver()
    BaseRequest.setRequestDriver(new MockRequestDriver())

    const resetDriver = resetMockRequestDriver()

    resetDriver.expect({
      method: RequestMethodEnum.GET,
      url: 'https://example.com/text',
      response: {
        status: 200,
        body: 'restored',
      },
    })

    const response = await new MockTextRequest().send({ resolveBody: false })

    expect(resetDriver).toBe(driver)
    await expect(response.text()).resolves.toBe('restored')
    expect(() => driver.assertExpectationsMet()).not.toThrow()
  })

  it('renders detailed JSON mismatch output', async () => {
    const driver = new MockRequestDriver()
      .expect({
        method: RequestMethodEnum.POST,
        url: 'https://example.com/mock',
        body: {
          user: {
            name: 'Ada',
          },
        },
        response: jsonResponse(200, { ok: true }),
      })

    await expect(
      driver.send(
        'https://example.com/mock',
        RequestMethodEnum.POST,
        {},
        createBody('{"user":{"name":"Grace"}}')
      )
    ).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Differing JSON paths: user.name'),
      })
    )
  })

  it('still supports binary and form data bodies', async () => {
    const chunk = new Uint8Array([1, 2, 3, 4])
    const binaryDriver = new MockRequestDriver()
      .expect({
        method: RequestMethodEnum.PUT,
        url: 'https://example.com/binary',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: chunk,
        response: emptyResponse(),
      })

    await binaryDriver.send(
      'https://example.com/binary',
      RequestMethodEnum.PUT,
      {},
      createBody(chunk, { 'Content-Type': 'application/octet-stream' })
    )

    expect(binaryDriver.getHistory()[0]?.body).toEqual({
      kind: 'binary',
      bytes: [1, 2, 3, 4],
    })

    const formData = new FormData()
    formData.append('name', 'Ada')
    formData.append('avatar', new File(['binary'], 'avatar.txt', { type: 'text/plain' }))

    const formDriver = new MockRequestDriver()
      .expect({
        method: RequestMethodEnum.POST,
        url: 'https://example.com/form',
        body: formData,
        response: emptyResponse(),
      })

    await formDriver.send('https://example.com/form', RequestMethodEnum.POST, {}, createBody(formData, {}))

    expect(formDriver.getHistory()[0]?.body).toEqual({
      kind: 'form-data',
      entries: [
        {
          key: 'name',
          value: {
            kind: 'text',
            value: 'Ada',
          },
        },
        {
          key: 'avatar',
          value: {
            kind: 'file',
            name: 'avatar.txt',
            mimeType: 'text/plain',
            bytes: [98, 105, 110, 97, 114, 121],
          },
        },
      ],
    })
  })

  it('still fails immediately for unexpected requests', async () => {
    const driver = new MockRequestDriver()

    await expect(driver.send('https://example.com/extra', RequestMethodEnum.GET, {})).rejects.toBeInstanceOf(MockRequestAssertionError)
  })
})
