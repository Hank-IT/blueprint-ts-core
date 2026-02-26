import { ResponseException } from '../../exceptions/ResponseException'
import { FetchResponse } from './FetchResponse'
import { RequestMethodEnum } from '../../RequestMethod.enum'
import { type HeadersContract, type HeaderValue } from '../../contracts/HeadersContract'
import { type BodyContract } from '../../contracts/BodyContract'
import { type RequestDriverContract } from '../../contracts/RequestDriverContract'
import { type DriverConfigContract } from '../../contracts/DriverConfigContract'
import { type ResponseHandlerContract } from '../contracts/ResponseHandlerContract'

enum FetchDriverCredentialConfigEnum {
  OMIT = 'omit',
  INCLUDE = 'include'
}

interface FetchDriverConfig {
  method: RequestMethodEnum
  headers: HeadersContract
  credentials?: FetchDriverCredentialConfigEnum | undefined
  signal?: AbortSignal | undefined
  body?: string | FormData | Blob | ArrayBuffer | ArrayBufferView | URLSearchParams | undefined
}

export class FetchDriver implements RequestDriverContract {
  public constructor(protected config?: DriverConfigContract) {}

  public async send(
    url: URL | string,
    method: RequestMethodEnum,
    headers: HeadersContract,
    body?: BodyContract,
    requestConfig?: DriverConfigContract
  ): Promise<ResponseHandlerContract> {
    const mergedConfig: DriverConfigContract = {
      // Global config
      ...this.config,

      // Request specific overrides
      ...(requestConfig ?? {})
    }

    const mergedHeaders: HeadersContract = {
      // Set global headers
      ...this.config?.headers,

      // Set headers from the request
      ...headers,

      // Set Content-Type header
      ...body?.getHeaders()
    }

    const resolvedHeaders = this.resolveHeaders(mergedHeaders)

    const fetchConfig = this.buildRequestConfig(mergedConfig, method, resolvedHeaders, body)

    const response = await fetch(url, fetchConfig as RequestInit)

    const fetchResponse = new FetchResponse(response)

    if (!response.ok) {
      throw new ResponseException(fetchResponse)
    }

    return fetchResponse
  }

  protected buildRequestConfig(
    config: DriverConfigContract,
    method: RequestMethodEnum,
    headers: HeadersContract,
    body?: BodyContract
  ): FetchDriverConfig {
    return {
      method: method,
      headers: headers,
      credentials: this.getCorsWithCredentials(config.corsWithCredentials),
      signal: config.abortSignal ?? undefined,
      body: [RequestMethodEnum.GET, RequestMethodEnum.HEAD].includes(method) ? undefined : body?.getContent()
    }
  }

  protected getCorsWithCredentials(corsWithCredentials: boolean | undefined): FetchDriverCredentialConfigEnum {
    // Request takes precedence
    if (corsWithCredentials === true) {
      return FetchDriverCredentialConfigEnum.INCLUDE
    }

    if (corsWithCredentials === false) {
      return FetchDriverCredentialConfigEnum.OMIT
    }

    // Fallback to default config
    if (this.config) {
      return this.config.corsWithCredentials ? FetchDriverCredentialConfigEnum.INCLUDE : FetchDriverCredentialConfigEnum.OMIT
    }

    // Fallback to safe option if no default set
    return FetchDriverCredentialConfigEnum.OMIT
  }

  protected resolveHeaders(headers: HeadersContract): HeadersContract {
    const resolved: HeadersContract = {}
    for (const key in headers) {
      const value: HeaderValue | undefined = headers[key]

      if (value === undefined) {
        continue
      }

      resolved[key] = typeof value === 'function' ? value() : value
    }

    return resolved
  }
}
