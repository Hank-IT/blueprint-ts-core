import { BaseResponse } from './BaseResponse'

export class JsonResponse<ResponseBodyInterface> extends BaseResponse<ResponseBodyInterface> {
  public getAcceptHeader(): string {
    return 'application/json'
  }

  protected resolveBody(): Promise<ResponseBodyInterface> {
    if (!this.response) {
      throw new Error('Response is not set')
    }

    return this.response.json<ResponseBodyInterface>()
  }
}
