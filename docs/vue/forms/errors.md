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
- remapping via `errorMap` (including mapping one server key to multiple fields)

## Checking For Errors

```ts
form.hasErrors()
```

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
