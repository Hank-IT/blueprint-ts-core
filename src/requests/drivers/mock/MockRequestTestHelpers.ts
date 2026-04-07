import { isEqual } from 'lodash-es'
import { BaseRequest } from '../../BaseRequest'
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

let installedMockRequestDriver: MockRequestDriver | undefined

export function installMockRequestDriver(options: InstallMockRequestDriverOptions = {}): MockRequestDriver {
  const driver = new MockRequestDriver(
    options.config,
    options.expectations ?? [],
    options.matchMode !== undefined ? { matchMode: options.matchMode } : {}
  )

  BaseRequest.setRequestDriver(driver)
  installedMockRequestDriver = driver

  return driver
}

export function resetMockRequestDriver(): MockRequestDriver {
  if (!installedMockRequestDriver) {
    return installMockRequestDriver()
  }

  installedMockRequestDriver.reset()
  BaseRequest.setRequestDriver(installedMockRequestDriver)

  return installedMockRequestDriver
}

export { getMockRequestJsonBody, getMockRequestTextBody, getMockRequestQuery }
export type { MockNormalizedRequestBody, MockRequestHistoryEntry }
