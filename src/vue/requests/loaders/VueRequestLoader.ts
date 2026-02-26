import { type Ref, ref } from 'vue'
import { type RequestLoaderContract } from '../../../requests/contracts/RequestLoaderContract'

export class VueRequestLoader implements RequestLoaderContract<Ref<boolean>> {
  protected loading: Ref<boolean>

  public constructor(initialLoading: boolean = false) {
    this.loading = ref<boolean>(initialLoading)
  }

  isLoading(): Ref<boolean> {
    return this.loading
  }

  setLoading(value: boolean): void {
    this.loading.value = value
  }
}
