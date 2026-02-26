# Persistence

This service provides simple persistence drivers that implement a common `PersistenceDriver` interface. It is used by `BaseForm`, but can also be used directly.

## Available Drivers

- `NonPersistentDriver` — no persistence (default for `BaseForm`)
- `SessionStorageDriver` — uses `sessionStorage`
- `LocalStorageDriver` — uses `localStorage`

All drivers are exported from `@blueprint-ts/core/persistenceDrivers`.

## Using A Driver

```ts
import { LocalStorageDriver } from '@blueprint-ts/core/persistenceDrivers'

const driver = new LocalStorageDriver('optional-suffix')

driver.set('my-key', { value: 123 })
const value = driver.get<{ value: number }>('my-key')
```

## Implementing A Custom Driver

Implement the `PersistenceDriver` interface:

```ts
import { type PersistenceDriver } from '@blueprint-ts/core/persistenceDrivers'

export class MemoryDriver implements PersistenceDriver {
  private store = new Map<string, unknown>()

  get<T>(key: string): T | null {
    return (this.store.get(key) as T) ?? null
  }

  set<T>(key: string, state: T): void {
    this.store.set(key, state)
  }

  remove(key: string): void {
    this.store.delete(key)
  }
}
```
