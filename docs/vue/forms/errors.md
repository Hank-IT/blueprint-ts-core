# Errors

`BaseForm` maps validation errors to fields and exposes them on `properties.<field>.errors`.

## Filling External Errors

`fillErrors` is intended for server-side validation responses.
It overwrites any existing client-side validation errors.

### Expected Error Format

`fillErrors` expects an object where each key is a field path and each value is an array of messages. For example:

```json
{
  "email": ["The email field is required."],
  "positions.0.value": ["The value is invalid."]
}
```

If you provide a single string instead of an array, it will be assigned as-is, but the UI helpers assume arrays.
This format matches Laravel's validation error response and is currently the only supported format.

```ts
form.fillErrors(error.response.data.errors)
```

`fillErrors` supports:
- direct field keys (e.g. `email`)
- array dot notation where the 2nd segment is a numeric index (e.g. `positions.0.value`)
- nested object paths for `PropertyAwareObject` fields (e.g. `payload.command`)
- nested array + object paths (e.g. `steps.0.payload.command`)
- remapping via `errorMap` (including mapping one server key to multiple fields)

Examples:

```ts
form.fillErrors({
  'payload.command': ['The command is required.'],
  'steps.0.payload.command': ['The step command is required.']
})
```

```vue
<template>
  <div>{{ form.properties.payload.command.errors[0] }}</div>
  <div>{{ form.properties.steps[0].payload.command.errors[0] }}</div>
</template>
```

## Checking For Errors

```ts
form.hasErrors()
```

Get the current flattened error bag:

```ts
form.getErrors()
```

This returns dot-path keyed messages such as:

```ts
{
  'email': ['The email field is required.'],
  'positions.0.value': ['The value is invalid.']
}
```

If you use validation groups, you can also read only the current errors for one group:

```ts
form.getErrorsInGroup('details')
form.getErrorsInGroup('positions')
```

Like `hasErrorsInGroup(...)`, this uses prefix-subtree matching, so a group entry like `positions` includes nested keys such as `positions.0.value`.

## Advanced Usage

### Mapping Server Errors

This is especially useful for appended fields that do not exist in your form state. See [Building Payloads – Appended Fields](/vue/forms/payloads#appended-fields).

Map server error keys to your form fields with `errorMap`:

```ts
protected override errorMap: { [serverKey: string]: string | string[] } = {
  started_at: ['start_date', 'start_time'],
  ended_at: ['end_date', 'end_time']
}
```
