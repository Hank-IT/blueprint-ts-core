export interface PersistenceDriver {
  get<T>(key: string): T | null
  set<T>(key: string, state: T): void
  remove(key: string): void
}
