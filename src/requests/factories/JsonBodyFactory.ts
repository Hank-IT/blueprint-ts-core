import { JsonBody } from '../bodies/JsonBody'
import { type BodyFactoryContract } from '../contracts/BodyFactoryContract'
import { type BodyContract } from '../contracts/BodyContract'

export class JsonBodyFactory<RequestBodyInterface> implements BodyFactoryContract<RequestBodyInterface> {
  public make(body: RequestBodyInterface): BodyContract {
    return new JsonBody<RequestBodyInterface>(body)
  }
}
