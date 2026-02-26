import { type Ref, ref, computed } from 'vue'
import { type RequestLoaderContract } from '../../../service/requests/contracts/RequestLoaderContract'

export class VueRequestBatchLoader implements RequestLoaderContract<Ref<boolean>> {
  private inFlight: Ref<number> = ref(0)
  private completed: Ref<number> = ref(0)
  private expected: number = 0

  constructor(expectedRequests: number = 0) {
    this.expected = expectedRequests
  }

  public startBatch(count: number) {
    this.expected = count
    this.completed.value = 0
  }

  public abortBatch() {
    this.expected = 0
    this.completed.value = 0
  }

  public isLoading(): Ref<boolean> {
    return computed(() => this.inFlight.value > 0 || (this.expected > 0 && this.completed.value < this.expected))
  }

  public setLoading(loading: boolean): void {
    if (loading) {
      this.inFlight.value++
    } else {
      this.inFlight.value = Math.max(0, this.inFlight.value - 1)
      this.completed.value++
    }
  }
}
