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
