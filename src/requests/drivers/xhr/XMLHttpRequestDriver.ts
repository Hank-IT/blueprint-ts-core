import { ResponseException } from '../../exceptions/ResponseException'
import { RequestMethodEnum } from '../../RequestMethod.enum'
import { type HeadersContract, type HeaderValue } from '../../contracts/HeadersContract'
import { type BodyContract } from '../../contracts/BodyContract'
import { type RequestDriverContract } from '../../contracts/RequestDriverContract'
import { type DriverConfigContract } from '../../contracts/DriverConfigContract'
import { type ResponseHandlerContract } from '../contracts/ResponseHandlerContract'
import { XMLHttpRequestResponse } from './XMLHttpRequestResponse'

export class XMLHttpRequestDriver implements RequestDriverContract {
  public constructor(protected config?: DriverConfigContract) {}

  public async send(
    url: URL | string,
    method: RequestMethodEnum,
    headers: HeadersContract,
    body?: BodyContract,
    requestConfig?: DriverConfigContract
  ): Promise<ResponseHandlerContract> {
    const mergedConfig: DriverConfigContract = {
      ...this.config,
      ...(requestConfig ?? {})
    }

    const mergedHeaders: HeadersContract = {
      ...this.config?.headers,
      ...headers,
      ...body?.getHeaders()
    }

    const resolvedHeaders = this.resolveHeaders(mergedHeaders)

    return await new Promise<ResponseHandlerContract>((resolve, reject) => {
      const request = new XMLHttpRequest()
      const requestUrl = url instanceof URL ? url.toString() : url
      const requestBody = [RequestMethodEnum.GET, RequestMethodEnum.HEAD].includes(method) ? undefined : body?.getContent()
      const abortSignal = mergedConfig.abortSignal
      const handleAbortSignal = () => request.abort()

      const cleanup = () => {
        request.onload = null
        request.onerror = null
        request.onabort = null

        if (request.upload) {
          request.upload.onprogress = null
        }

        abortSignal?.removeEventListener('abort', handleAbortSignal)
      }

      request.open(method, requestUrl, true)
      request.responseType = 'blob'
      request.withCredentials = this.getCorsWithCredentials(mergedConfig.corsWithCredentials)

      for (const key in resolvedHeaders) {
        request.setRequestHeader(key, resolvedHeaders[key] as string)
      }

      request.onload = () => {
        cleanup()

        if (request.status === 0) {
          reject(new Error('No response received.'))
          return
        }

        const response = new XMLHttpRequestResponse(request)

        if (request.status < 200 || request.status >= 300) {
          reject(new ResponseException(response))
          return
        }

        resolve(response)
      }

      request.onerror = () => {
        cleanup()
        reject(new Error('Network request failed.'))
      }

      request.onabort = () => {
        cleanup()
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      }

      if (request.upload) {
        request.upload.onprogress = (event: ProgressEvent<EventTarget>) => {
          const total = event.lengthComputable ? event.total : undefined

          mergedConfig.onUploadProgress?.({
            loaded: event.loaded,
            total: total,
            lengthComputable: event.lengthComputable,
            progress: total === undefined || total === 0 ? undefined : event.loaded / total
          })
        }
      }

      if (abortSignal?.aborted) {
        handleAbortSignal()
        return
      }

      abortSignal?.addEventListener('abort', handleAbortSignal, { once: true })
      request.send(requestBody)
    })
  }

  protected getCorsWithCredentials(corsWithCredentials: boolean | undefined): boolean {
    if (corsWithCredentials === true) {
      return true
    }

    if (corsWithCredentials === false) {
      return false
    }

    return this.config?.corsWithCredentials ?? false
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
