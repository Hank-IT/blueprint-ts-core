import { type PersistenceDriver } from './types/PersistenceDriver'

export class SessionStorageDriver implements PersistenceDriver {
  public constructor(protected suffix?: string) {}

  private storageKey(key: string): string {
    return this.suffix ? `state_${key}_${this.suffix}` : `state_${key}`
  }

  get<T>(key: string): T | null {
    const data = sessionStorage.getItem(this.storageKey(key))

    return data ? JSON.parse(data) : null
  }
  set<T>(key: string, state: T): void {
    sessionStorage.setItem(this.storageKey(key), JSON.stringify(state))
  }

  remove(key: string): void {
    sessionStorage.removeItem(this.storageKey(key))
  }
}
