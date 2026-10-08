import { ref, type Ref } from 'vue'
import { type BaseViewDriverContract } from '../contracts/BaseViewDriverContract'

export class VueBaseViewDriver<ResourceInterface> implements BaseViewDriverContract<ResourceInterface[]> {
  protected initializedRef: Ref<boolean> = ref(false)
  protected dataRef: Ref<ResourceInterface[]>
  protected totalRef: Ref<number>

  public constructor() {
    this.dataRef = ref([]) as Ref<ResourceInterface[]>
    this.totalRef = ref<number>(0)
  }

  public isInitialized(): boolean {
    return this.initializedRef.value
  }

  public setInitialized(value: boolean): void {
    this.initializedRef.value = value
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
