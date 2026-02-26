import { PaginationDataDto } from './PaginationDataDto'

export class StatePaginationDataDto<ResourceInterface> extends PaginationDataDto<ResourceInterface> {
  public constructor(
    data: ResourceInterface,
    total: number,
    protected state: string | null = null
  ) {
    super(data, total)
  }

  public getState(): string | null {
    return this.state
  }

  public hasNextPage(): boolean {
    return this.state !== null
  }
}
