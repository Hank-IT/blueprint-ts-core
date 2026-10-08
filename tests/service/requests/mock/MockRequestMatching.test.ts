import { beforeEach, describe, expect, it } from 'vitest'
import {
  BaseRequest,
  JsonBodyFactory,
  JsonResponse,
  MockRequestDriver,
  RequestMethodEnum,
  createMockRequestScope,
  emptyResponse,
  expectJsonBody,
  jsonResponse,
  matchHeaders,
  matchQuery,
  type MockRequestExpectationCriteria
} from '../../../../src/requests'
import type { BodyContent, BodyContract } from '../../../../src/requests/contracts/BodyContract'

class WriteRequest extends BaseRequest<boolean, object, { ok: boolean }, JsonResponse<{ ok: boolean }>, object> {
  public method() {
    return RequestMethodEnum.POST
  }
  public url() {
    return '/write'
  }
  public getResponse() {
    return new JsonResponse<{ ok: boolean }>()
  }
  public override getRequestBodyFactory() {
    return new JsonBodyFactory<object>()
  }
}

const body = (content: BodyContent): BodyContract => ({ getContent: () => content, getHeaders: () => ({}) })
const criteria = { method: RequestMethodEnum.POST, url: 'https://example.com/write' }

describe('mock request matching and diagnostics', () => {
  beforeEach(() => BaseRequest.getDefaultClient().setBaseUrl('https://example.com'))

  it('fails scope disposal when a required request was never sent', async () => {
    const scope = createMockRequestScope({ makeDefault: false })
    scope.driver.expect({ ...criteria, response: emptyResponse() })
    scope.driver.expect({ method: RequestMethodEnum.DELETE, url: 'https://example.com/obsolete', response: emptyResponse() })
    await new WriteRequest().setClient(scope.client).send({ resolveBody: false })
    expect(() => scope.dispose()).toThrow(
      'Expected 1 more mocked request(s).\nMatch mode: ordered\nNext expected request: DELETE https://example.com/obsolete'
    )
  })

  it.each<{ field: string; expected: Partial<MockRequestExpectationCriteria>; diagnostic: string }>([
    { field: 'method', expected: { method: RequestMethodEnum.GET }, diagnostic: 'HTTP method did not match.' },
    { field: 'method', expected: { method: Object.assign(() => false, { description: 'a read method' }) }, diagnostic: 'a read method' },
    { field: 'url', expected: { url: new URL('https://example.com/other') }, diagnostic: 'URL did not match.' },
    { field: 'url', expected: { url: () => false }, diagnostic: 'URL matcher returned false.' },
    { field: 'headers', expected: { headers: { Accept: 'text/plain' } }, diagnostic: 'Headers did not match exactly.' },
    { field: 'headers', expected: { headers: matchHeaders({ 'X-Required': 'yes' }) }, diagnostic: 'headers subset' },
    { field: 'query', expected: { query: { mode: 'saved' } }, diagnostic: 'Query parameters did not match exactly.' },
    { field: 'query', expected: { query: matchQuery({ mode: 'saved' }) }, diagnostic: 'query subset' },
    { field: 'body', expected: { body: 'not JSON' }, diagnostic: 'Body did not match exactly.' },
    { field: 'body', expected: { body: expectJsonBody({ name: 'expected' }) }, diagnostic: 'JSON body' }
  ])('reports $field mismatches and keeps the failure visible at disposal ($diagnostic)', async ({ field, expected, diagnostic }) => {
    const scope = createMockRequestScope({ makeDefault: false })
    scope.driver.expect({ ...criteria, ...expected, response: emptyResponse() })
    const send = new WriteRequest().setClient(scope.client).setBody({ name: 'actual' }).send({ resolveBody: false })
    await expect(send).rejects.toThrow(`Mock request ${field} mismatch.`)
    await expect(send).rejects.toThrow(diagnostic)
    expect(() => scope.dispose()).toThrow(`Mock request ${field} mismatch.`)
  })

  it('lists unmatched unordered expectations and does not consume them on failure', async () => {
    const scope = createMockRequestScope({ makeDefault: false, matchMode: 'unordered' })
    scope.driver.expect({ ...criteria, body: { name: 'first' }, response: emptyResponse() })
    scope.driver.expect({ ...criteria, body: { name: 'second' }, response: emptyResponse() })
    const send = (name: string) => new WriteRequest().setClient(scope.client).setBody({ name }).send({ resolveBody: false })
    await expect(send('unexpected')).rejects.toThrow('Pending expectations:\n1. POST https://example.com/write\n2. POST https://example.com/write')
    await send('second')
    await send('first')
    expect(scope.driver.getHistory()).toHaveLength(3)
    expect(() => scope.dispose()).toThrow('Mock request did not match any pending expectation.')
  })

  it('uses predicates and response factories with the actual serialized request', async () => {
    const scope = createMockRequestScope({ makeDefault: false })
    const payload = { users: [{ name: 'Ada', role: 'admin' }, { name: 'Grace' }] }
    scope.driver.expect({
      method: (method) => method === RequestMethodEnum.POST,
      url: (url) => url.pathname === '/write',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Dynamic': () => 'resolved' },
      query: matchQuery({ tag: ['a', 'b', 'c'] }),
      body: expectJsonBody({ users: [{ name: 'Ada' }] }, { partial: true }),
      response: (request) => {
        expect(request.getJson()).toEqual(payload)
        expect(request.getText()).toBe(JSON.stringify(payload))
        expect(request.getQuery()).toEqual({ tag: ['a', 'b', 'c'] })
        return jsonResponse(201, { ok: true }, { 'X-Saved': 'yes' })
      }
    })
    class TaggedWriteRequest extends WriteRequest {
      public override url() {
        return '/write?tag=a&tag=b&tag=c'
      }
    }
    const response = await new TaggedWriteRequest()
      .setClient(scope.client)
      .setHeaders({ 'X-Dynamic': () => 'resolved' })
      .setBody(payload)
      .send()
    expect(response.getBody()).toEqual({ ok: true })
    expect(response.getHeaders()).toMatchObject({ 'x-saved': 'yes' })
    scope.dispose()
  })

  it.each([{ users: 'not an array' }, { users: [] }, { users: ['not an object'] }, { users: [{ name: 'Grace' }] }])(
    'rejects incomplete partial JSON matches: %j',
    async (payload) => {
      const scope = createMockRequestScope({ makeDefault: false })
      scope.driver.expect({ ...criteria, body: expectJsonBody({ users: [{ name: 'Ada' }] }, { partial: true }), response: emptyResponse() })
      await expect(new WriteRequest().setClient(scope.client).setBody(payload).send()).rejects.toThrow('Body matcher returned false.')
      expect(() => scope.dispose()).toThrow('JSON body partial')
    }
  )

  it('rejects non-JSON text in a JSON body matcher', async () => {
    const driver = new MockRequestDriver().expect({ ...criteria, body: expectJsonBody({ name: 'Ada' }), response: emptyResponse() })
    await expect(driver.send(criteria.url, criteria.method, {}, body('invalid JSON'))).rejects.toThrow('Body matcher returned false.')
    expect(() => driver.assertExpectationsMet()).toThrow('JSON body')
  })

  it('does not consume a required expectation when the driver is called with an already aborted signal', async () => {
    const driver = new MockRequestDriver().expect({ ...criteria, response: emptyResponse(204, { 'X-Saved': 'yes' }) })
    const controller = new AbortController()
    controller.abort()
    await expect(driver.send(criteria.url, criteria.method, {}, undefined, { abortSignal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError'
    })
    expect(() => driver.assertNoPendingExpectations()).toThrow('Expected 1 more mocked request(s).')
    const response = await driver.send(new URL(criteria.url), criteria.method, {})
    expect(response.getHeaders()).toEqual({ 'x-saved': 'yes' })
    expect(driver.getHistory()).toHaveLength(2)
    expect(() => driver.assertNoPendingExpectations()).not.toThrow()
  })

  it.each([
    ['ArrayBuffer', () => new Uint8Array([1, 2, 3]).buffer],
    ['offset view', () => new Uint8Array([0, 1, 2, 3, 4]).subarray(1, 4)],
    ['Blob', () => new Blob([new Uint8Array([1, 2, 3])])]
  ] as const)('matches the exact bytes of a %s upload', async (_name, content) => {
    const driver = new MockRequestDriver().expect({ ...criteria, body: new Uint8Array([1, 2, 3]).buffer, response: emptyResponse() })
    await driver.send(criteria.url, criteria.method, {}, body(content()))
    expect(driver.getHistory()[0]?.body).toEqual({ kind: 'binary', bytes: [1, 2, 3] })
    driver.assertExpectationsMet()
  })
})
