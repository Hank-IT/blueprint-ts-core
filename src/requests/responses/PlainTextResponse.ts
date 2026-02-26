import { BaseResponse } from './BaseResponse'

export class PlainTextResponse extends BaseResponse<string> {
  public getAcceptHeader(): string {
    return 'text/plain'
  }

  protected resolveBody(): Promise<string> {
    if (!this.response) {
      throw new Error('Response is not set')
    }

    return this.response.text()
  }
}
