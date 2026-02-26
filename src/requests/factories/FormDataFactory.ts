import { FormDataBody } from '../bodies/FormDataBody'
import { type BodyFactoryContract } from '../contracts/BodyFactoryContract'
import { type BodyContract } from '../contracts/BodyContract'

type FormDataPrimitive = string | number | boolean | null | Date | Blob
type FormDataValue = FormDataPrimitive | FormDataValue[] | { [key: string]: FormDataValue }

export class FormDataFactory<
  RequestBodyInterface extends Record<string, FormDataValue | undefined>
> implements BodyFactoryContract<RequestBodyInterface> {
  public make(body: RequestBodyInterface): BodyContract {
    return new FormDataBody<RequestBodyInterface>(body)
  }
}
