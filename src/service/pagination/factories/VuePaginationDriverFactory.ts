import { VuePaginationDriver } from '../frontendDrivers/VuePaginationDriver'
import { type ViewDriverFactoryContract } from '../contracts/ViewDriverFactoryContract'
import { type ViewDriverContract } from '../contracts/ViewDriverContract'

export class VuePaginationDriverFactory implements ViewDriverFactoryContract {
  public make<ResourceInterface>(pageNumber: number, pageSize: number): ViewDriverContract<ResourceInterface[]> {
    return new VuePaginationDriver<ResourceInterface>(pageNumber, pageSize)
  }
}
