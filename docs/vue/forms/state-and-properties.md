# State And Properties

`BaseForm` tracks the original state and the current state of each field.

```ts
form.isDirty() // any field modified
form.isDirty('email') // specific field modified

form.touch('email')
form.isTouched('email')
```

**Properties**

`properties.<field>` exposes:

- `model` (a `ComputedRef` compatible with `v-model`)
- `errors` (array)
- `dirty` and `touched`

Example:

```vue
<input v-model="form.properties.email.model.value" />
<div v-if="form.properties.email.dirty">This field has been changed</div>
<div v-if="form.properties.email.errors.length">{{ form.properties.email.errors[0] }}</div>
```

## State snapshots

`getStateSnapshot()` returns an independent copy of the current editable values. Changing the snapshot does not edit the form:

```ts
form.properties.email.model.value = 'ada@example.test'

const values = form.getStateSnapshot()
values.email = 'grace@example.test'

form.properties.email.model.value // 'ada@example.test'
```

Snapshots preserve editable fields and their value types, including fields omitted or transformed by `buildPayload()`. Nested objects and arrays are copied, form array wrappers are preserved, and immutable `File`/`Blob` values are retained. Validation errors, touched flags, and the baseline are separate from this snapshot.

Use `buildPayload()` when an operation needs the form's transformed payload. To apply saved values as the baseline, see [Saving Form Values](./saving).

## Nested Object Properties

If a field is declared as `PropertyAwareObject`, its nested keys are also exposed as property-aware fields.

```vue
<template>
  <input v-model="form.properties.payload.command.model.value" />
  <div v-if="form.properties.payload.command.dirty">Command changed</div>
  <div v-if="form.properties.payload.command.errors.length">
    {{ form.properties.payload.command.errors[0] }}
  </div>
</template>
```

This is opt-in. Plain objects do not expose nested property-aware keys.
