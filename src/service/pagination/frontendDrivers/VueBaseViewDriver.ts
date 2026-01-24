import { ref, type Ref } from 'vue'
import { type BaseViewDriverContract } from '../contracts/BaseViewDriverContract'

export class VueBaseViewDriver<ResourceInterface> implements BaseViewDriverContract<ResourceInterface[]> {
  protected dataRef: Ref<ResourceInterface[]>
  protected totalRef: Ref<number>

  public constructor() {
    this.dataRef = ref([]) as Ref<ResourceInterface[]>
    this.totalRef = ref<number>(0)
  }

  public setData(data: ResourceInterface[]): void {
    this.dataRef.value = data
  }

  public getData(): ResourceInterface[] {
    return this.dataRef.value
  }

  public setTotal(value: number): void {
    this.totalRef.value = value
  }

  public getTotal(): number {
    return this.totalRef.value
  }
}
