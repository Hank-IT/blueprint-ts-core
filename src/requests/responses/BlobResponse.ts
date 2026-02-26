import { BaseResponse } from './BaseResponse'

export class BlobResponse extends BaseResponse<Blob> {
  public constructor(protected mimeType: string = 'application/octet-stream') {
    super()
  }

  public getAcceptHeader(): string {
    return this.mimeType
  }

  protected resolveBody(): Promise<Blob> {
    if (!this.response) {
      throw new Error('Response is not set')
    }

    return this.response.blob()
  }
}
