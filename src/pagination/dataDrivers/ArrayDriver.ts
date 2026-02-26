import { type PaginationDataDriverContract, PaginationDataDto } from '../index'

export class ArrayDriver<ResourceInterface> implements PaginationDataDriverContract<ResourceInterface[]> {
  public constructor(protected data: ResourceInterface[]) {}

  public get(page: number, size: number): Promise<PaginationDataDto<ResourceInterface[]>> {
    return new Promise((resolve) => {
      resolve(
        new PaginationDataDto<ResourceInterface[]>(
          this.data.slice(this.calculatedStart(page, size), this.calculatedEnd(page, size)),
          this.data.length
        )
      )
    })
  }

  public setData(data: ResourceInterface[]): void {
    this.data = data
  }

  protected calculatedStart(currentPage: number, pageSize: number): number {
    return (currentPage - 1) * pageSize
  }

  protected calculatedEnd(currentPage: number, pageSize: number): number {
    return currentPage * pageSize
  }
}
