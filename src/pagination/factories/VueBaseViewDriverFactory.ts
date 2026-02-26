import { type BaseViewDriverFactoryContract } from '../contracts/BaseViewDriverFactoryContract'
import { type BaseViewDriverContract } from '../contracts/BaseViewDriverContract'
import { VueBaseViewDriver } from '../frontendDrivers/VueBaseViewDriver'

export class VueBaseViewDriverFactory implements BaseViewDriverFactoryContract {
  public make<ResourceInterface>(): BaseViewDriverContract<ResourceInterface[]> {
    return new VueBaseViewDriver<ResourceInterface>()
  }
}
