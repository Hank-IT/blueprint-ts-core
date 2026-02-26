import { type ViewDriverContract } from './ViewDriverContract'

export interface ViewDriverFactoryContract {
  make<ResourceInterface>(page: number, size: number): ViewDriverContract<ResourceInterface[]>
}
