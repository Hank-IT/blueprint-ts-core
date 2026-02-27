import { VueRequestLoader } from '../loaders/VueRequestLoader'
import { type RequestLoaderContract } from '../../../requests/contracts/RequestLoaderContract'
import { type Ref } from 'vue'
import type { RequestLoaderFactoryContract } from '../../../requests'

export class VueRequestLoaderFactory implements RequestLoaderFactoryContract<Ref<boolean>> {
  public make(): RequestLoaderContract<Ref<boolean>> {
    return new VueRequestLoader()
  }
}
