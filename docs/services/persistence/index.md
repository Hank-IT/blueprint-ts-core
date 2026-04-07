# Persistence

This service provides simple persistence drivers that implement a common `PersistenceDriver` interface. It is used by `BaseForm`, but can also be used directly.

## Available Drivers

- `NonPersistentDriver` — no persistence (default for `BaseForm`)
- `MemoryPersistenceDriver` — keeps data in memory, useful for tests and non-browser environments
- `SessionStorageDriver` — uses `sessionStorage`
- `LocalStorageDriver` — uses `localStorage`

All drivers are exported from `@blueprint-ts/core/persistenceDrivers`.

## Using A Driver

```ts
import { MemoryPersistenceDriver } from '@blueprint-ts/core/persistenceDrivers'

const driver = new MemoryPersistenceDriver('optional-suffix')

driver.set('my-key', { value: 123 })
const value = driver.get<{ value: number }>('my-key')
```

Multiple `MemoryPersistenceDriver` instances share the same in-memory store when they use the same suffix and key. This
makes it convenient for tests where one instance writes persisted state and another instance asserts it later.

If you need to reset the in-memory store between tests:

```ts
MemoryPersistenceDriver.clear()
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
