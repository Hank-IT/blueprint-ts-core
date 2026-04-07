import { type ResolvedHeadersContract } from '../../contracts/HeadersContract'
import { type ResponseHandlerContract } from '../contracts/ResponseHandlerContract'

export type MockResponseBody = string | Blob | BufferSource | object | null | undefined

export interface MockResponseDefinition {
  status?: number
  statusText?: string
  headers?: ResolvedHeadersContract
  body?: MockResponseBody
}

export class MockResponseHandler implements ResponseHandlerContract {
  protected response: Response

  public constructor(definition: MockResponseDefinition) {
    const headers = new Headers(definition.headers)
    const body = this.resolveBody(definition.body, headers)

    this.response = new Response(body, {
      status: definition.status ?? 200,
      headers,
      ...(definition.statusText !== undefined ? { statusText: definition.statusText } : {})
    })
  }

  public getStatusCode(): number | undefined {
    return this.response.status
  }

  public getHeaders(): ResolvedHeadersContract {
    return Object.fromEntries(this.response.headers)
  }

  public getRawResponse(): Response {
    return this.response
  }

  public async json<ResponseBodyInterface>(): Promise<ResponseBodyInterface> {
    return await this.response.clone().json()
  }

  public async text(): Promise<string> {
    return await this.response.clone().text()
  }

  public async blob(): Promise<Blob> {
    return await this.response.clone().blob()
  }

  protected resolveBody(body: MockResponseBody, headers: Headers): BodyInit | null | undefined {
    if (body === undefined || body === null) {
      return body
    }

    if (this.isJsonValue(body)) {
      if (!this.hasHeader(headers, 'content-type')) {
        headers.set('content-type', 'application/json')
      }

      return JSON.stringify(body)
    }

    return body
  }

  protected isJsonValue(value: MockResponseBody): value is object {
    return typeof value === 'object' && value !== null && !(value instanceof Blob) && !(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)
  }

  protected hasHeader(headers: Headers, key: string): boolean {
    return Array.from(headers.keys()).some((headerKey) => headerKey.toLowerCase() === key.toLowerCase())
  }
}
