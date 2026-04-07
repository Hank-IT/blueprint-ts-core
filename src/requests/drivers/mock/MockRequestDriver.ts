import { ResponseException } from '../../exceptions/ResponseException'
import { isEqual } from 'lodash-es'
import { type BodyContent, type BodyContract } from '../../contracts/BodyContract'
import { type DriverConfigContract } from '../../contracts/DriverConfigContract'
import { type HeaderValue, type HeadersContract, type ResolvedHeadersContract } from '../../contracts/HeadersContract'
import { type RequestDriverContract } from '../../contracts/RequestDriverContract'
import { RequestMethodEnum } from '../../RequestMethod.enum'
import { type ResponseHandlerContract } from '../contracts/ResponseHandlerContract'
import { MockRequestAssertionError } from './MockRequestAssertionError'
import { type MockResponseBody, type MockResponseDefinition, MockResponseHandler } from './MockResponseHandler'

export type MockRequestBody = BodyContent | Record<string, unknown> | unknown[] | null | undefined
export type MockRequestMatchMode = 'ordered' | 'unordered'
export type MockRequestPredicate<T> = ((value: T) => boolean) & {
  description?: string
}

export interface MockRequestDriverOptions {
  matchMode?: MockRequestMatchMode
}

export interface MockRequestQuery {
  [key: string]: string | string[]
}

export interface MockRequestBodyMatchContext {
  method: RequestMethodEnum
  url: string
  headers: ResolvedHeadersContract
  body?: MockNormalizedRequestBody
  getJson<T>(): T | undefined
  getText(): string | undefined
  getQuery(): MockRequestQuery
}

export type MockRequestMethodMatcher = RequestMethodEnum | MockRequestPredicate<RequestMethodEnum>
export type MockRequestUrlMatcher = URL | string | MockRequestPredicate<URL>
export type MockRequestHeadersMatcher = HeadersContract | ResolvedHeadersContract | MockRequestPredicate<ResolvedHeadersContract>
export type MockRequestQueryMatcher = MockRequestQuery | MockRequestPredicate<MockRequestQuery>
export type MockRequestBodyMatcher = MockRequestBody | MockRequestPredicate<MockRequestBodyMatchContext>

export interface MockRequestExpectation {
  method: MockRequestMethodMatcher
  url: MockRequestUrlMatcher
  headers?: MockRequestHeadersMatcher
  query?: MockRequestQueryMatcher
  body?: MockRequestBodyMatcher
  response: MockResponseDefinition
}

export interface MockRequestExpectationCriteria {
  method: MockRequestMethodMatcher
  url: MockRequestUrlMatcher
  headers?: MockRequestHeadersMatcher
  query?: MockRequestQueryMatcher
  body?: MockRequestBodyMatcher
}

export type MockNormalizedRequestBody =
  | { kind: 'text'; value: string }
  | { kind: 'binary'; mimeType?: string; bytes: number[] }
  | { kind: 'form-data'; entries: MockNormalizedFormDataEntry[] }
  | { kind: 'null' }

export interface MockNormalizedFormDataEntry {
  key: string
  value: { kind: 'text'; value: string } | { kind: 'file'; name?: string; mimeType?: string; bytes: number[] }
}

export interface MockRequestHistoryEntry {
  method: RequestMethodEnum
  url: string
  headers: ResolvedHeadersContract
  body?: MockNormalizedRequestBody
}

interface NormalizedMockRequest {
  method: RequestMethodEnum
  url: string
  urlWithoutQuery: string
  parsedUrl: URL
  headers: ResolvedHeadersContract
  query: MockRequestQuery
  body?: MockNormalizedRequestBody
}

interface MockRequestMatchFailure {
  field: 'method' | 'url' | 'headers' | 'query' | 'body'
  message: string
  expectation: MockRequestExpectation
  expectedValue?: unknown
  actualValue?: unknown
  diffPaths?: string[]
}

function isPredicate<T>(value: unknown): value is MockRequestPredicate<T> {
  return typeof value === 'function'
}

function parseUrl(url: URL | string): URL {
  if (url instanceof URL) {
    return url
  }

  return new URL(url, 'https://mock-request.invalid')
}

function buildUrlWithoutQuery(url: URL): string {
  const clone = new URL(url.toString())
  clone.search = ''

  return clone.toString()
}

function parseQuery(url: URL): MockRequestQuery {
  const query: MockRequestQuery = {}

  for (const [key, value] of url.searchParams.entries()) {
    const current = query[key]

    if (current === undefined) {
      query[key] = value
      continue
    }

    if (Array.isArray(current)) {
      current.push(value)
      continue
    }

    query[key] = [current, value]
  }

  return query
}

function stringify(value: unknown): string {
  return value === undefined ? 'undefined' : JSON.stringify(value, null, 2)
}

function getPredicateDescription<T>(predicate: MockRequestPredicate<T>): string {
  return predicate.description ?? '[custom matcher]'
}

function getTextBody(body?: MockNormalizedRequestBody): string | undefined {
  if (!body || body.kind !== 'text') {
    return undefined
  }

  return body.value
}

function getJsonBody<T>(body?: MockNormalizedRequestBody): T | undefined {
  const textBody = getTextBody(body)

  if (textBody === undefined) {
    return undefined
  }

  try {
    return JSON.parse(textBody) as T
  } catch {
    return undefined
  }
}

function collectJsonDiffPaths(expected: unknown, actual: unknown, path = '', maxPaths = 10): string[] {
  const mismatches: string[] = []

  const visit = (left: unknown, right: unknown, currentPath: string): void => {
    if (mismatches.length >= maxPaths) {
      return
    }

    if (JSON.stringify(left) === JSON.stringify(right)) {
      return
    }

    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        mismatches.push(currentPath || '(root)')
        return
      }

      left.forEach((item, index) => {
        visit(item, right[index], currentPath ? `${currentPath}.${index}` : String(index))
      })

      return
    }

    if (isRecord(left) && isRecord(right)) {
      const keys = new Set([...Object.keys(left), ...Object.keys(right)])

      for (const key of keys) {
        visit(left[key], right[key], currentPath ? `${currentPath}.${key}` : key)

        if (mismatches.length >= maxPaths) {
          return
        }
      }

      return
    }

    mismatches.push(currentPath || '(root)')
  }

  visit(expected, actual, path)

  return mismatches
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export class MockRequestExpectationBuilder {
  protected criteria: MockRequestExpectationCriteria

  public constructor(
    protected readonly driver: MockRequestDriver,
    criteria: MockRequestExpectationCriteria
  ) {
    this.criteria = { ...criteria }
  }

  public withHeaders(headers: MockRequestHeadersMatcher): this {
    this.criteria.headers = headers

    return this
  }

  public withQuery(query: MockRequestQueryMatcher): this {
    this.criteria.query = query

    return this
  }

  public withBody(body: MockRequestBodyMatcher): this {
    this.criteria.body = body

    return this
  }

  public respond(response: MockResponseDefinition): MockRequestDriver {
    this.driver.expect({
      ...this.criteria,
      response
    })

    return this.driver
  }
}

export class MockRequestDriver implements RequestDriverContract {
  protected expectations: MockRequestExpectation[] = []
  protected history: MockRequestHistoryEntry[] = []
  protected matchMode: MockRequestMatchMode

  public constructor(
    protected config?: DriverConfigContract,
    expectations: MockRequestExpectation[] = [],
    options: MockRequestDriverOptions = {}
  ) {
    this.expectations.push(...expectations)
    this.matchMode = options.matchMode ?? 'ordered'
  }

  public setMatchMode(mode: MockRequestMatchMode): this {
    this.matchMode = mode

    return this
  }

  public ordered(): this {
    return this.setMatchMode('ordered')
  }

  public unordered(): this {
    return this.setMatchMode('unordered')
  }

  public expect(expectation: MockRequestExpectation): this {
    this.expectations.push(expectation)

    return this
  }

  public expectAny(criteria: MockRequestExpectationCriteria): MockRequestExpectationBuilder {
    return new MockRequestExpectationBuilder(this, criteria)
  }

  public reset(): this {
    this.expectations = []
    this.history = []

    return this
  }

  public getHistory(): MockRequestHistoryEntry[] {
    return [...this.history]
  }

  public assertNoPendingExpectations(): void {
    this.assertExpectationsMet()
  }

  public assertExpectationsMet(): void {
    if (this.expectations.length === 0) {
      return
    }

    const nextExpectation = this.expectations[0]

    if (!nextExpectation) {
      return
    }

    throw new MockRequestAssertionError(
      [
        `Expected ${this.expectations.length} more mocked request(s).`,
        `Match mode: ${this.matchMode}`,
        `Next expected request: ${this.describeExpectation(nextExpectation)}`
      ].join('\n')
    )
  }

  public async send(
    url: URL | string,
    method: RequestMethodEnum,
    headers: HeadersContract,
    body?: BodyContract,
    requestConfig?: DriverConfigContract
  ): Promise<ResponseHandlerContract> {
    if (requestConfig?.abortSignal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }

    const actualRequest = await this.normalizeActualRequest(url, method, headers, body)
    const { index, expectation } = await this.selectExpectation(actualRequest)

    this.expectations.splice(index, 1)
    this.history.push(this.toHistoryEntry(actualRequest))

    const response = new MockResponseHandler(expectation.response)

    if (!response.getRawResponse().ok) {
      throw new ResponseException(response)
    }

    return response
  }

  protected async selectExpectation(actualRequest: NormalizedMockRequest): Promise<{ index: number; expectation: MockRequestExpectation }> {
    if (this.expectations.length === 0) {
      throw new MockRequestAssertionError(this.buildUnexpectedRequestMessage(actualRequest))
    }

    if (this.matchMode === 'ordered') {
      const expectation = this.expectations[0]

      if (!expectation) {
        throw new MockRequestAssertionError(this.buildUnexpectedRequestMessage(actualRequest))
      }

      const failure = await this.matchExpectation(expectation, actualRequest)

      if (failure) {
        throw new MockRequestAssertionError(this.buildMismatchMessage(failure, actualRequest))
      }

      return { index: 0, expectation }
    }

    const failures: MockRequestMatchFailure[] = []

    for (const [index, expectation] of this.expectations.entries()) {
      const failure = await this.matchExpectation(expectation, actualRequest)

      if (!failure) {
        return { index, expectation }
      }

      failures.push(failure)
    }

    throw new MockRequestAssertionError(this.buildUnorderedMismatchMessage(actualRequest, failures))
  }

  protected async matchExpectation(
    expectation: MockRequestExpectation,
    actualRequest: NormalizedMockRequest
  ): Promise<MockRequestMatchFailure | undefined> {
    const methodFailure = this.matchMethod(expectation.method, actualRequest, expectation)

    if (methodFailure) {
      return methodFailure
    }

    const urlFailure = this.matchUrl(expectation, actualRequest)

    if (urlFailure) {
      return urlFailure
    }

    const headersFailure = this.matchHeaders(expectation.headers, actualRequest, expectation)

    if (headersFailure) {
      return headersFailure
    }

    const queryFailure = this.matchQuery(expectation.query, actualRequest, expectation)

    if (queryFailure) {
      return queryFailure
    }

    return await this.matchBody(expectation.body, actualRequest, expectation)
  }

  protected matchMethod(
    method: MockRequestMethodMatcher,
    actualRequest: NormalizedMockRequest,
    expectation: MockRequestExpectation
  ): MockRequestMatchFailure | undefined {
    if (isPredicate<RequestMethodEnum>(method)) {
      if (method(actualRequest.method)) {
        return undefined
      }

      return {
        field: 'method',
        message: 'Method matcher returned false.',
        expectation,
        expectedValue: getPredicateDescription(method),
        actualValue: actualRequest.method
      }
    }

    if (method === actualRequest.method) {
      return undefined
    }

    return {
      field: 'method',
      message: 'HTTP method did not match.',
      expectation,
      expectedValue: method,
      actualValue: actualRequest.method
    }
  }

  protected matchUrl(expectation: MockRequestExpectation, actualRequest: NormalizedMockRequest): MockRequestMatchFailure | undefined {
    if (isPredicate<URL>(expectation.url)) {
      if (expectation.url(actualRequest.parsedUrl)) {
        return undefined
      }

      return {
        field: 'url',
        message: 'URL matcher returned false.',
        expectation,
        expectedValue: getPredicateDescription(expectation.url),
        actualValue: actualRequest.url
      }
    }

    const expectedUrl = parseUrl(expectation.url)
    const actualComparableUrl = expectation.query !== undefined && expectedUrl.search.length === 0 ? actualRequest.urlWithoutQuery : actualRequest.url
    const expectedComparableUrl =
      expectation.query !== undefined && expectedUrl.search.length === 0 ? buildUrlWithoutQuery(expectedUrl) : this.normalizeUrl(expectation.url)

    if (expectedComparableUrl === actualComparableUrl) {
      return undefined
    }

    return {
      field: 'url',
      message: 'URL did not match.',
      expectation,
      expectedValue: expectedComparableUrl,
      actualValue: actualComparableUrl
    }
  }

  protected matchHeaders(
    headers: MockRequestHeadersMatcher | undefined,
    actualRequest: NormalizedMockRequest,
    expectation: MockRequestExpectation
  ): MockRequestMatchFailure | undefined {
    if (headers === undefined) {
      return undefined
    }

    if (isPredicate<ResolvedHeadersContract>(headers)) {
      if (headers(actualRequest.headers)) {
        return undefined
      }

      return {
        field: 'headers',
        message: 'Header matcher returned false.',
        expectation,
        expectedValue: getPredicateDescription(headers),
        actualValue: actualRequest.headers
      }
    }

    const expectedHeaders = this.resolveHeaders(headers)

    if (isEqual(expectedHeaders, actualRequest.headers)) {
      return undefined
    }

    return {
      field: 'headers',
      message: 'Headers did not match exactly.',
      expectation,
      expectedValue: expectedHeaders,
      actualValue: actualRequest.headers
    }
  }

  protected matchQuery(
    query: MockRequestQueryMatcher | undefined,
    actualRequest: NormalizedMockRequest,
    expectation: MockRequestExpectation
  ): MockRequestMatchFailure | undefined {
    if (query === undefined) {
      return undefined
    }

    if (isPredicate<MockRequestQuery>(query)) {
      if (query(actualRequest.query)) {
        return undefined
      }

      return {
        field: 'query',
        message: 'Query matcher returned false.',
        expectation,
        expectedValue: getPredicateDescription(query),
        actualValue: actualRequest.query
      }
    }

    if (isEqual(query, actualRequest.query)) {
      return undefined
    }

    return {
      field: 'query',
      message: 'Query parameters did not match exactly.',
      expectation,
      expectedValue: query,
      actualValue: actualRequest.query
    }
  }

  protected async matchBody(
    body: MockRequestBodyMatcher | undefined,
    actualRequest: NormalizedMockRequest,
    expectation: MockRequestExpectation
  ): Promise<MockRequestMatchFailure | undefined> {
    if (body === undefined) {
      return undefined
    }

    if (isPredicate<MockRequestBodyMatchContext>(body)) {
      const context = this.createBodyMatchContext(actualRequest)

      if (body(context)) {
        return undefined
      }

      return {
        field: 'body',
        message: 'Body matcher returned false.',
        expectation,
        expectedValue: getPredicateDescription(body),
        actualValue: this.describeBodyForMessage(actualRequest.body)
      }
    }

    const expectedBody = await this.normalizeBody(body)

    if (JSON.stringify(expectedBody) === JSON.stringify(actualRequest.body)) {
      return undefined
    }

    const expectedJson = getJsonBody(expectedBody)
    const actualJson = getJsonBody(actualRequest.body)

    return {
      field: 'body',
      message: expectedJson !== undefined && actualJson !== undefined ? 'JSON body did not match.' : 'Body did not match exactly.',
      expectation,
      expectedValue: expectedJson ?? expectedBody,
      actualValue: actualJson ?? actualRequest.body,
      ...(expectedJson !== undefined && actualJson !== undefined ? { diffPaths: collectJsonDiffPaths(expectedJson, actualJson) } : {})
    }
  }

  protected createBodyMatchContext(actualRequest: NormalizedMockRequest): MockRequestBodyMatchContext {
    return {
      method: actualRequest.method,
      url: actualRequest.url,
      headers: actualRequest.headers,
      ...(actualRequest.body !== undefined ? { body: actualRequest.body } : {}),
      getJson: <T>() => getJsonBody<T>(actualRequest.body),
      getText: () => getTextBody(actualRequest.body),
      getQuery: () => actualRequest.query
    }
  }

  protected async normalizeActualRequest(
    url: URL | string,
    method: RequestMethodEnum,
    headers: HeadersContract,
    body?: BodyContract
  ): Promise<NormalizedMockRequest> {
    const resolvedUrl = parseUrl(url)
    const normalizedBody = await this.normalizeBody(body?.getContent())

    return {
      method,
      url: this.normalizeUrl(url),
      urlWithoutQuery: buildUrlWithoutQuery(resolvedUrl),
      parsedUrl: resolvedUrl,
      headers: this.resolveHeaders({
        ...this.config?.headers,
        ...headers,
        ...body?.getHeaders()
      }),
      query: parseQuery(resolvedUrl),
      ...(normalizedBody !== undefined ? { body: normalizedBody } : {})
    }
  }

  protected toHistoryEntry(request: NormalizedMockRequest): MockRequestHistoryEntry {
    return {
      method: request.method,
      url: request.url,
      headers: request.headers,
      ...(request.body !== undefined ? { body: request.body } : {})
    }
  }

  protected buildUnexpectedRequestMessage(actualRequest: NormalizedMockRequest): string {
    return ['Unexpected request received with no expectations left.', '', 'Actual request:', this.formatRequestSnapshot(actualRequest)].join('\n')
  }

  protected buildUnorderedMismatchMessage(actualRequest: NormalizedMockRequest, failures: MockRequestMatchFailure[]): string {
    const pending = this.expectations.map((expectation, index) => `${index + 1}. ${this.describeExpectation(expectation)}`).join('\n')
    const firstFailure = failures[0]

    return [
      'Mock request did not match any pending expectation.',
      firstFailure ? `Closest failure: ${firstFailure.message}` : 'No expectation matched.',
      '',
      'Actual request:',
      this.formatRequestSnapshot(actualRequest),
      '',
      'Pending expectations:',
      pending
    ].join('\n')
  }

  protected buildMismatchMessage(failure: MockRequestMatchFailure, actualRequest: NormalizedMockRequest): string {
    const lines = [
      `Mock request ${failure.field} mismatch.`,
      failure.message,
      '',
      'Expected request:',
      this.formatExpectationSnapshot(failure.expectation),
      '',
      'Actual request:',
      this.formatRequestSnapshot(actualRequest)
    ]

    if (failure.expectedValue !== undefined || failure.actualValue !== undefined) {
      lines.push('', `Expected ${failure.field}: ${stringify(failure.expectedValue)}`, `Actual ${failure.field}: ${stringify(failure.actualValue)}`)
    }

    if (failure.diffPaths && failure.diffPaths.length > 0) {
      lines.push('', `Differing JSON paths: ${failure.diffPaths.join(', ')}`)
    }

    return lines.join('\n')
  }

  protected formatExpectationSnapshot(expectation: MockRequestExpectation): string {
    const lines = [`method: ${this.describeMatcher(expectation.method)}`, `url: ${this.describeUrlMatcher(expectation)}`]

    if (expectation.headers !== undefined) {
      lines.push(`headers: ${this.describeMatcher(expectation.headers)}`)
    }

    if (expectation.query !== undefined) {
      lines.push(`query: ${this.describeMatcher(expectation.query)}`)
    }

    if (expectation.body !== undefined) {
      lines.push(`body: ${this.describeBodyMatcher(expectation.body)}`)
    }

    return lines.join('\n')
  }

  protected formatRequestSnapshot(request: NormalizedMockRequest): string {
    const lines = [
      `method: ${request.method}`,
      `url: ${request.url}`,
      `headers: ${stringify(request.headers)}`,
      `query: ${stringify(request.query)}`,
      `body: ${stringify(this.describeBodyForMessage(request.body))}`
    ]

    return lines.join('\n')
  }

  protected describeExpectation(expectation: MockRequestExpectation): string {
    return `${this.describeMatcher(expectation.method)} ${this.describeUrlMatcher(expectation)}`
  }

  protected describeMatcher(matcher: unknown): string {
    if (isPredicate<unknown>(matcher)) {
      return getPredicateDescription(matcher)
    }

    if (typeof matcher === 'object') {
      return stringify(matcher)
    }

    return String(matcher)
  }

  protected describeUrlMatcher(expectation: MockRequestExpectation): string {
    if (isPredicate<URL>(expectation.url)) {
      return getPredicateDescription(expectation.url)
    }

    const url = parseUrl(expectation.url)

    if (expectation.query !== undefined && url.search.length === 0) {
      return buildUrlWithoutQuery(url)
    }

    return this.normalizeUrl(expectation.url)
  }

  protected describeBodyMatcher(body: MockRequestBodyMatcher): string {
    if (isPredicate<MockRequestBodyMatchContext>(body)) {
      return getPredicateDescription(body)
    }

    return stringify(body)
  }

  protected describeBodyForMessage(body?: MockNormalizedRequestBody): unknown {
    const json = getJsonBody(body)

    return json ?? body
  }

  protected normalizeUrl(url: URL | string): string {
    return parseUrl(url).toString()
  }

  protected resolveHeaders(headers: HeadersContract | ResolvedHeadersContract): ResolvedHeadersContract {
    const resolved: ResolvedHeadersContract = {}

    for (const key in headers) {
      const value: HeaderValue | string | undefined = headers[key]

      if (value === undefined) {
        continue
      }

      resolved[key] = typeof value === 'function' ? value() : value
    }

    return resolved
  }

  protected async normalizeBody(body: MockRequestBody): Promise<MockNormalizedRequestBody | undefined> {
    if (body === undefined) {
      return undefined
    }

    if (body === null) {
      return { kind: 'null' }
    }

    if (typeof body === 'string') {
      return { kind: 'text', value: body }
    }

    if (body instanceof FormData) {
      return await this.normalizeFormData(body)
    }

    if (body instanceof Blob) {
      const mimeType = body.type || undefined

      return {
        kind: 'binary',
        ...(mimeType !== undefined ? { mimeType } : {}),
        bytes: Array.from(new Uint8Array(await this.readBlob(body)))
      }
    }

    if (this.isBufferSource(body)) {
      return {
        kind: 'binary',
        bytes: Array.from(new Uint8Array(this.toArrayBuffer(body)))
      }
    }

    return {
      kind: 'text',
      value: JSON.stringify(body)
    }
  }

  protected async normalizeFormData(body: FormData): Promise<MockNormalizedRequestBody> {
    const entries: MockNormalizedFormDataEntry[] = []

    for (const [key, value] of body.entries()) {
      if (typeof value === 'string') {
        entries.push({ key, value: { kind: 'text', value } })
        continue
      }

      entries.push({
        key,
        value: {
          kind: 'file',
          ...this.getOptionalBlobDetails(value),
          bytes: Array.from(new Uint8Array(await this.readBlob(value)))
        }
      })
    }

    return { kind: 'form-data', entries }
  }

  protected getBlobName(value: Blob): string | undefined {
    if (typeof File !== 'undefined' && value instanceof File) {
      return value.name
    }

    return undefined
  }

  protected getOptionalBlobDetails(value: Blob): { name?: string; mimeType?: string } {
    const name = this.getBlobName(value)
    const mimeType = value.type || undefined

    return {
      ...(name !== undefined ? { name } : {}),
      ...(mimeType !== undefined ? { mimeType } : {})
    }
  }

  protected async readBlob(value: Blob): Promise<ArrayBuffer> {
    const blobWithReader = value as Blob & {
      arrayBuffer?: () => Promise<ArrayBuffer>
    }

    if (typeof blobWithReader.arrayBuffer === 'function') {
      return await blobWithReader.arrayBuffer()
    }

    if (typeof FileReader !== 'undefined') {
      return await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()

        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read Blob contents.'))
        reader.readAsArrayBuffer(value)
      })
    }

    return await new Response(value).arrayBuffer()
  }

  protected isBufferSource(value: MockRequestBody): value is BufferSource {
    return value instanceof ArrayBuffer || ArrayBuffer.isView(value)
  }

  protected toArrayBuffer(value: BufferSource): ArrayBuffer {
    if (value instanceof ArrayBuffer) {
      return value.slice(0)
    }

    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
  }
}

export type { MockResponseBody, MockResponseDefinition }

export function getMockRequestJsonBody<T>(request: Pick<MockRequestHistoryEntry, 'body'>): T | undefined {
  return getJsonBody<T>(request.body)
}

export function getMockRequestTextBody(request: Pick<MockRequestHistoryEntry, 'body'>): string | undefined {
  return getTextBody(request.body)
}

export function getMockRequestQuery(request: Pick<MockRequestHistoryEntry, 'url'>): MockRequestQuery {
  return parseQuery(parseUrl(request.url))
}
