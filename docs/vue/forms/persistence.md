# Persistence

Enable temporary draft persistence with `persist: true` and a stable `persistKey`:

```ts
super(defaults, {
  persist: true,
  persistKey: 'profile-editor',
  persistSuffix: profileId
})
```

Override `getPersistenceDriver(suffix)` to choose `SessionStorageDriver`, `LocalStorageDriver`, or a custom `PersistenceDriver`. `MemoryPersistenceDriver` supports isolated tests. A `persistKey` without `persist: true` does not enable persistence.

## Draft contents

Drafts are unversioned objects containing editable `state`, the `original` baseline, and `touched` flags. Dirty state is recalculated by comparing the restored values with the baseline.

```ts
{
  state: { name: 'Edited' },
  original: { name: 'Loaded' },
  touched: { name: true }
}
```

These drafts hold temporary editing state. They are not a format for long-term application storage.

## Restoring a draft

Blueprint validates the structure before calling `getPersistenceRestorePolicy()`: state and baseline must be objects containing only fields declared in the constructor values, and each declared field must have a boolean touched flag. Malformed drafts are discarded.

JSON omits object fields whose values are `undefined`. Omitted values are restored as `undefined`, including nested object properties. Baseline comparison treats omitted and explicitly undefined object properties equally; `null` remains a distinct value. Include optional fields in the constructor values even when their initial value is `undefined`.

The default `StrictPersistenceRestorePolicy` restores only when the draft's original baseline matches the constructor values. Otherwise it discards the draft. Keep initial values stable when a create draft should survive reopening.

Override `getPersistenceRestorePolicy()` to choose another restore rule for structurally valid drafts. Application-specific validity checks can also be implemented in a persistence driver that wraps the underlying storage driver.

`acceptSavedValues()` persists the new current values and baseline. `clearPersistedDraft()` removes the stored draft without changing form values or their baseline. `reset()` restores the current baseline.

Override `shouldLogPersistenceDebug()` to return true to log restore/discard decisions. Logging is disabled by default. Logs include the stable key, form name, suffix, decision reason, and available mismatch paths.
