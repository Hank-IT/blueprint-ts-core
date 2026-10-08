import { isEqual } from 'lodash-es'
import { RequestClient, createRequestScope } from '../../RequestClient'
import { type DriverConfigContract } from '../../contracts/DriverConfigContract'
import { type ResolvedHeadersContract } from '../../contracts/HeadersContract'
import {
  type MockNormalizedRequestBody,
  type MockRequestBodyMatchContext,
  type MockRequestDriverOptions,
  MockRequestDriver,
  type MockRequestExpectation,
  type MockRequestHistoryEntry,
  type MockRequestPredicate,
  type MockRequestQuery,
  getMockRequestJsonBody,
  getMockRequestQuery,
  getMockRequestTextBody
} from './MockRequestDriver'
import { type MockResponseDefinition } from './MockResponseHandler'

export interface InstallMockRequestDriverOptions extends MockRequestDriverOptions {
  config?: DriverConfigContract
  expectations?: MockRequestExpectation[]
}

function createPredicate<T>(description: string, predicate: (value: T) => boolean): MockRequestPredicate<T> {
  const matcher = ((value: T) => predicate(value)) as MockRequestPredicate<T>
  matcher.description = description

  return matcher
}

function matchesSubset(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length < expected.length) {
      return false
    }

    return expected.every((item, index) => matchesSubset(actual[index], item))
  }

  if (isRecord(expected)) {
    if (!isRecord(actual)) {
      return false
    }

    return Object.keys(expected).every((key) => matchesSubset(actual[key], expected[key]))
  }

  return isEqual(actual, expected)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function matchHeaders(expectedSubset: ResolvedHeadersContract): MockRequestPredicate<ResolvedHeadersContract> {
  return createPredicate(`headers subset ${JSON.stringify(expectedSubset)}`, (actual) =>
    Object.entries(expectedSubset).every(([key, value]) => actual[key] === value)
  )
}

export function matchQuery(expectedSubset: MockRequestQuery): MockRequestPredicate<MockRequestQuery> {
  return createPredicate(`query subset ${JSON.stringify(expectedSubset)}`, (actual) =>
    Object.entries(expectedSubset).every(([key, value]) => isEqual(actual[key], value))
  )
}

export function expectJsonBody(expected: unknown, options: { partial?: boolean } = {}): MockRequestPredicate<MockRequestBodyMatchContext> {
  return createPredicate(options.partial ? `JSON body partial ${JSON.stringify(expected)}` : `JSON body ${JSON.stringify(expected)}`, (context) => {
    const actual = context.getJson()

    if (actual === undefined) {
      return false
    }

    return options.partial ? matchesSubset(actual, expected) : isEqual(actual, expected)
  })
}

export function jsonResponse<ResponseBody extends object | string | Blob | BufferSource | null | undefined>(
  status: number,
  body: ResponseBody,
  headers?: ResolvedHeadersContract
): MockResponseDefinition {
  return {
    status,
    ...(headers !== undefined ? { headers } : {}),
    body
  }
}

export function validationError(errors: Record<string, string[]>, message = 'The given data was invalid.'): MockResponseDefinition {
  return jsonResponse(422, {
    message,
    errors
  })
}

export function emptyResponse(status = 204, headers?: ResolvedHeadersContract): MockResponseDefinition {
  return {
    status,
    ...(headers !== undefined ? { headers } : {})
  }
}

export function installMockRequestDriver(options: InstallMockRequestDriverOptions = {}, client = RequestClient.getDefault()): MockRequestDriver {
  const driver = new MockRequestDriver(
    options.config,
    options.expectations ?? [],
    options.matchMode === undefined ? {} : { matchMode: options.matchMode }
  )
  client.setTransportOverride(driver)
  client.onDispose(() => driver.assertExpectationsMet())
  return driver
}

export function resetMockRequestDriver(client = RequestClient.getDefault()): MockRequestDriver {
  const driver = client.getTransportOverride()
  if (!(driver instanceof MockRequestDriver)) return installMockRequestDriver({}, client)
  driver.reset()
  return driver
}

export { getMockRequestJsonBody, getMockRequestTextBody, getMockRequestQuery }
export type { MockNormalizedRequestBody, MockRequestHistoryEntry }

/** A response controlled by the test, without replacing the request or serialization path. */
export function deferredResponse(): {
  respond: () => Promise<MockResponseDefinition>
  resolve: (response: MockResponseDefinition) => void
  reject: (error: unknown) => void
} {
  let resolve!: (response: MockResponseDefinition) => void
  let reject!: (error: unknown) => void
  const response = new Promise<MockResponseDefinition>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { respond: () => response, resolve, reject }
}

export function createMockRequestScope(options: InstallMockRequestDriverOptions & { client?: RequestClient; makeDefault?: boolean } = {}): {
  client: RequestClient
  driver: MockRequestDriver
  dispose(): void
} {
  const scope = createRequestScope(options)
  const driver = installMockRequestDriver(options, scope.client)
  return { client: scope.client, driver, dispose: scope.dispose }
}
