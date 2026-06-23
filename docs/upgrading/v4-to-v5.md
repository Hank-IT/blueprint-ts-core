# Upgrading v4 to v5

This guide covers breaking changes when upgrading from v4 to v5.

## Persisted State and Forms Require `persistKey`

`State` and `BaseForm` persistence no longer derives storage keys from `this.constructor.name`.

### What Changed

Production bundlers can minify class names. A class such as `UserState` can become a generated name in the built output, which changes persisted storage keys between deployments. That can leave stale entries in browser storage and prevent persisted UI state or form drafts from restoring.

Persisted `State` and `BaseForm` instances now require an explicit `persistKey`. If persistence is enabled without `persistKey`, Blueprint throws a clear error.

`BaseForm` persistence is also no longer enabled by default. Forms only persist when `persist: true` is set.

### How to Fix State

Add a stable semantic key anywhere `persist: true` is used:

```typescript
class UserState extends State<UserStateData> {
  public constructor() {
    super(defaults, {
      persist: true,
      persistKey: 'user-state'
    })
  }
}
```

If you use `persistSuffix`, keep it as a namespace:

```typescript
super(defaults, {
  persist: true,
  persistKey: 'user-state',
  persistSuffix: 'tenant-a'
})
```

### How to Fix BaseForm

Add `persist: true` and a stable key for persisted forms:

```typescript
class ProfileForm extends BaseForm<ProfilePayload, ProfileState> {
  public constructor() {
    super(defaults, {
      persist: true,
      persistKey: 'profile-form'
    })
  }
}
```

If the form should not persist, omit the options or keep `persist: false` for explicitness:

```typescript
super(defaults)
super(defaults, { persist: false })
```