import { type BaseViewDriverContract } from './BaseViewDriverContract'

export interface BaseViewDriverFactoryContract {
  make<ResourceInterface>(): BaseViewDriverContract<ResourceInterface[]>
}
