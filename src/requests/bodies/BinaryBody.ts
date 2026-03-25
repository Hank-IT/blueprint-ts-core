import { type BodyContent, type BodyContract } from '../contracts/BodyContract'
import { type HeadersContract } from '../contracts/HeadersContract'

export class BinaryBody<RequestBody extends Exclude<BodyContent, string | FormData>> implements BodyContract {
  public constructor(
    protected data: RequestBody,
    protected contentType?: string
  ) {}

  public getHeaders(): HeadersContract {
    const contentType = this.resolveContentType()

    return contentType === undefined ? {} : { 'Content-Type': contentType }
  }

  public getContent(): RequestBody {
    return this.data
  }

  protected resolveContentType(): string | undefined {
    if (this.contentType !== undefined) {
      return this.contentType
    }

    if (typeof Blob !== 'undefined' && this.data instanceof Blob && this.data.type !== '') {
      return this.data.type
    }

    return undefined
  }
}
