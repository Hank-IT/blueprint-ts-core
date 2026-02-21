## Upgrading from v2 to v3

### BaseForm

#### Omission of fields with `undefined` values (Breaking Change)

Commit `26c0d0e` changed how `BaseForm.buildPayload()` handles `undefined` values returned by transformers (getters).

In v2, returning `undefined` from a getter would still include the key in the resulting payload object. In v3, the field is **omitted** entirely from the payload.

This applies to:
- **Field Getters**: `getFieldName(value)`
- **Composite Getters**: `getParentFieldNestedField(value)`
- **Appended Fields**: Getters for fields defined in the `append` array.
- **Nested Objects/Arrays**: Recursive transformation of nested data structures.

**How to upgrade:**
If you previously relied on a field being present with an `undefined` value in the JS object, you should now return `null` if you want the field to be included in the request payload.

```ts
// v2: payload was { name: undefined }
// v3: payload is {}
protected getName(value: string) {
  return value ? value : undefined
}

// v3: if you want the field to be included
protected getName(value: string) {
  return value ? value : null // payload is { name: null }
}
```

#### Removal of Suggestions (Breaking Change)

The suggestions feature has been removed from `BaseForm` in commit `f21d6ce`.

**Changes:**
- Removed `fillSuggestions()` method from `BaseForm`.
- Removed `suggestions` property from the `properties` tree (e.g., `form.properties.email.suggestions` is no longer available).
- Removed `suggestions` from `PropertyAwareField` and `PropertyAware` types.

**How to upgrade:**
If you were using the suggestions feature, you should now manage suggestions independently of the form state, for example, by using a separate reactive object or a dedicated composable.

#### File Upload Support and Form Data Handling

Commit `d765cae` introduced native support for `File` and `Blob` objects in `BaseForm`.

**Changes:**
- `BaseForm` now detects if the payload contains `File` or `Blob` objects.
- When sending a request with a `File` or `Blob` in the payload, the library will automatically use `FormData` and set the appropriate `Content-Type` header (multipart/form-data).
- `File` values are kept intact during the transformation process and are not converted into plain objects.
