# Persistence

Persistence is enabled by default. Disable it via `super(defaults, { persist: false })`.

Example:

```ts
protected override getPersistenceDriver(suffix?: string): PersistenceDriver {
  return new SessionStorageDriver(suffix)
}
```

See the Persistence service for available drivers and custom implementations: [Persistence](/services/persistence/).

Notes:
- `persistSuffix` is passed to `getPersistenceDriver(suffix)` for namespacing.
- Persisted state is restored through a restore policy. By default, Blueprint restores only when the stored `original` matches your current defaults.
- `persist: false` disables automatic rehydration and background persistence.
- `File`/`Blob` values are not JSON-serializable and should use `{ persist: false }`.

## Testing With In-Memory Persistence

When you want to assert persisted form drafts in tests without touching browser storage, use `MemoryPersistenceDriver`:

```ts
import { BaseForm, MemoryPersistenceDriver, type PersistenceDriver } from '@blueprint-ts/core/vue/forms'

export class TestForm extends BaseForm<RequestPayload, FormState> {
  protected override getPersistenceDriver(suffix?: string): PersistenceDriver {
    return new MemoryPersistenceDriver(suffix)
  }
}

beforeEach(() => {
  MemoryPersistenceDriver.clear()
})
```

Because the driver shares in-memory state across instances, one form instance can persist a draft and a later instance
can restore it in the same test.

## Default Restore Behavior

The built-in `StrictPersistenceRestorePolicy` behaves like this:

1. Blueprint asks the configured persistence driver for previously saved form state.
2. If no persisted state exists, the form starts from the constructor defaults.
3. If persisted state exists, Blueprint compares the persisted `original` value to the current constructor defaults.
4. If those values match, Blueprint restores:
   - the persisted form `state`
   - the persisted `original`
   - the persisted `dirty` flags
   - the persisted `touched` flags
5. If they do not match, Blueprint discards the persisted entry and starts from the constructor defaults.

The comparison ignores persistence-only markers used by `PropertyAwareObject`, so property-aware structures are compared by their actual form data.

## Restore Policy

Override `getPersistenceRestorePolicy()` when a form needs custom restore behavior:

```ts
import {
  BaseForm,
  StrictPersistenceRestorePolicy,
  type PersistenceRestorePolicy
} from '@blueprint-ts/core/vue/forms'

export class MyForm extends BaseForm<RequestPayload, FormState> {
  protected override getPersistenceRestorePolicy(): PersistenceRestorePolicy<FormState> {
    return new StrictPersistenceRestorePolicy<FormState>()
  }
}
```

The default implementation already returns `StrictPersistenceRestorePolicy`, so you only need to override this method when a form needs a custom policy.

## Debug Logging

Persistence debug logging is disabled by default. Enable it by overriding `shouldLogPersistenceDebug()`:

```ts
export class MyForm extends BaseForm<RequestPayload, FormState> {
  protected override shouldLogPersistenceDebug(): boolean {
    return true
  }
}
```

When enabled, Blueprint logs:
- when no persisted state exists
- when persisted state is restored
- when persisted state is discarded and why

This is useful when debugging why a draft was not restored without enabling noisy logging for all forms.
