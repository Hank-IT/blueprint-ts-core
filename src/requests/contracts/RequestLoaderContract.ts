export interface RequestLoaderContract<T> {
  isLoading(): T

  setLoading(value: boolean): void
}
