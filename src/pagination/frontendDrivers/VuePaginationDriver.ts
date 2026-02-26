import { computed, ref, type Ref, type ComputedRef } from 'vue'
import { type ViewDriverContract } from '../contracts/ViewDriverContract'

export class VuePaginationDriver<ResourceInterface> implements ViewDriverContract<ResourceInterface[]> {
  protected dataRef: Ref<ResourceInterface[]>
  protected currentPageRef: Ref<number>
  protected pageSizeRef: Ref<number>
  protected totalRef: Ref<number>
  protected totalPagesComputed: ComputedRef<number>
  protected pagesComputed: ComputedRef<number[]>

  public constructor(pageNumber: number, pageSize: number) {
    this.dataRef = ref([]) as Ref<ResourceInterface[]>
    this.currentPageRef = ref<number>(pageNumber)
    this.pageSizeRef = ref<number>(pageSize)
    this.totalRef = ref<number>(0)

    this.totalPagesComputed = computed(() => Math.ceil(this.totalRef.value / this.pageSizeRef.value))
    this.pagesComputed = computed(() => Array.from({ length: this.totalPagesComputed.value }, (_, i) => i + 1))
  }

  public setData(data: ResourceInterface[]): void {
    this.dataRef.value = data
  }

  public setTotal(value: number): void {
    this.totalRef.value = value
  }

  public getData(): ResourceInterface[] {
    return this.dataRef.value
  }

  public getCurrentPage(): number {
    return this.currentPageRef.value
  }

  public setPage(value: number): void {
    this.currentPageRef.value = value
  }

  public setPageSize(value: number): void {
    this.pageSizeRef.value = value
  }

  public getPageSize(): number {
    return this.pageSizeRef.value
  }

  public getLastPage(): number {
    return this.totalPagesComputed.value
  }

  public getPages(): number[] {
    return this.pagesComputed.value
  }

  public getTotal(): number {
    return this.totalRef.value
  }
}
