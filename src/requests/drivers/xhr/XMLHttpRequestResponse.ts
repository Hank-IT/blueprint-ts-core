import { type ResolvedHeadersContract } from '../../contracts/HeadersContract'
import { type ResponseHandlerContract } from '../contracts/ResponseHandlerContract'

export class XMLHttpRequestResponse implements ResponseHandlerContract {
  protected response: Response
  protected headers: ResolvedHeadersContract

  public constructor(protected request: XMLHttpRequest) {
    this.headers = this.parseHeaders(request.getAllResponseHeaders())
    this.response = new Response(this.getResponseBody(), {
      status: request.status,
      statusText: request.statusText,
      headers: Object.entries(this.headers).map(([key, value]) => [key, String(value)])
    })
  }

  public getStatusCode(): number | undefined {
    return this.request.status
  }

  public getHeaders(): ResolvedHeadersContract {
    return this.headers
  }

  public getRawResponse(): Response {
    return this.response
  }

  public async json<ResponseBodyInterface>(): Promise<ResponseBodyInterface> {
    return await this.response.json()
  }

  public async text(): Promise<string> {
    return await this.response.text()
  }

  public async blob(): Promise<Blob> {
    return await this.response.blob()
  }

  protected getResponseBody(): Blob | string | null {
    if ([204, 205, 304].includes(this.request.status)) {
      return null
    }

    if (this.request.response === null || this.request.response === undefined) {
      return null
    }

    if (this.isBlobLike(this.request.response) || typeof this.request.response === 'string') {
      return this.request.response
    }

    return new Blob([this.request.response])
  }

  protected isBlobLike(value: unknown): value is Blob {
    return (
      value instanceof Blob ||
      (typeof value === 'object' &&
        value !== null &&
        typeof (value as Blob).arrayBuffer === 'function' &&
        typeof (value as Blob).stream === 'function' &&
        typeof (value as Blob).text === 'function')
    )
  }

  protected parseHeaders(rawHeaders: string): ResolvedHeadersContract {
    const headers: ResolvedHeadersContract = {}
    const lines = rawHeaders.trim()

    if (lines.length === 0) {
      return headers
    }

    for (const line of lines.split(/\r?\n/)) {
      const separatorIndex = line.indexOf(':')

      if (separatorIndex === -1) {
        continue
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()

      if (key.length === 0) {
        continue
      }

      headers[key] = key in headers ? `${String(headers[key])}, ${value}` : value
    }

    return headers
  }
}
