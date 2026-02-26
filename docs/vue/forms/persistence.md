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
- Persisted state is reused only if the stored `original` matches your current defaults.
- `persist: false` disables automatic rehydration and background persistence.
- `File`/`Blob` values are not JSON-serializable and should use `{ persist: false }`.
