import { type PersistenceDriver } from './types/PersistenceDriver'

export class MemoryPersistenceDriver implements PersistenceDriver {
  protected static store: Map<string, string> = new Map()

  public constructor(protected suffix?: string) {}

  public static clear(): void {
    MemoryPersistenceDriver.store.clear()
  }

  protected storageKey(key: string): string {
    return this.suffix ? `state_${key}_${this.suffix}` : `state_${key}`
  }

  public get<T>(key: string): T | null {
    const data = MemoryPersistenceDriver.store.get(this.storageKey(key))

    return data ? JSON.parse(data) : null
  }

  public set<T>(key: string, state: T): void {
    MemoryPersistenceDriver.store.set(this.storageKey(key), JSON.stringify(state))
  }

  public remove(key: string): void {
    MemoryPersistenceDriver.store.delete(this.storageKey(key))
  }
}
