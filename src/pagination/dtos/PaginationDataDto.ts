export class PaginationDataDto<ResourceInterface> {
  public constructor(
    protected data: ResourceInterface,
    protected total: number
  ) {}

  public getData(): ResourceInterface {
    return this.data
  }

  public getTotal(): number {
    return this.total
  }
}
