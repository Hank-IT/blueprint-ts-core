import { type BodyContract } from '../contracts/BodyContract'
import { type HeadersContract } from '../contracts/HeadersContract'

export class JsonBody<RequestBody> implements BodyContract {
  public constructor(protected data: RequestBody) {}

  public getHeaders(): HeadersContract {
    return {
      'Content-Type': 'application/json'
    }
  }

  public getContent(): string {
    return JSON.stringify(this.data)
  }
}
