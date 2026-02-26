import { type BodyContract } from './BodyContract'

export interface BodyFactoryContract<RequestBodyInterface> {
  make(body: RequestBodyInterface): BodyContract
}
