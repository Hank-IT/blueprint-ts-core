import { BinaryBody } from '../bodies/BinaryBody'
import { type BodyFactoryContract } from '../contracts/BodyFactoryContract'
import { type BodyContent, type BodyContract } from '../contracts/BodyContract'

export type BinaryBodyContent = Exclude<BodyContent, string | FormData>

export class BinaryBodyFactory<RequestBodyInterface extends BinaryBodyContent> implements BodyFactoryContract<RequestBodyInterface> {
  public constructor(protected contentType?: string) {}

  public make(body: RequestBodyInterface): BodyContract {
    return new BinaryBody<RequestBodyInterface>(body, this.contentType)
  }
}
