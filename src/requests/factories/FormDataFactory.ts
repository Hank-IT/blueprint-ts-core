import { FormDataBody } from '../bodies/FormDataBody'
import { type BodyFactoryContract } from '../contracts/BodyFactoryContract'
import { type BodyContract } from '../contracts/BodyContract'

export class FormDataFactory<RequestBodyInterface> implements BodyFactoryContract<RequestBodyInterface> {
  public make(body: RequestBodyInterface): BodyContract {
    return new FormDataBody<RequestBodyInterface>(body)
  }
}
