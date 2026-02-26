import { VueRequestLoader } from '../loaders/VueRequestLoader'
import { type RequestLoaderContract } from '../../../service/requests/contracts/RequestLoaderContract'
import { type Ref } from 'vue'
import { RequestLoaderFactoryContract } from '../../../service/requests'

export class VueRequestLoaderFactory implements RequestLoaderFactoryContract<Ref<boolean>> {
  public make(): RequestLoaderContract<Ref<boolean>> {
    return new VueRequestLoader()
  }
}
