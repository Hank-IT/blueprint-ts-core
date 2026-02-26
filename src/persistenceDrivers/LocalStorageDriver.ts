import { type PersistenceDriver } from './types/PersistenceDriver'

export class LocalStorageDriver implements PersistenceDriver {
  public constructor(protected suffix?: string) {}

  private storageKey(key: string): string {
    return this.suffix ? `state_${key}_${this.suffix}` : `state_${key}`
  }

  get<T>(key: string): T | null {
    const data = localStorage.getItem(this.storageKey(key))

    return data ? JSON.parse(data) : null
  }
  set<T>(key: string, state: T): void {
    localStorage.setItem(this.storageKey(key), JSON.stringify(state))
  }

  remove(key: string): void {
    localStorage.removeItem(this.storageKey(key))
  }
}
