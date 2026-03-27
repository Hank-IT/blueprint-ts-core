# Building Payloads

## Overview

Form fields often need to be transformed before sending them to the server. You can define getters on your form class, and `buildPayload()` will use them to convert values.

`buildPayload()` supports three getter patterns.

## Getters

### Field Getters

Field getters are for fields that directly exist in the form state as top level property. They receive the current field value and return the value that should be sent in the payload.

Naming scheme: `get${upperFirst(camelCase(fieldName))}`. For example, `name` becomes `getName`, `user_id` becomes `getUserId`.

```ts
protected getName(value: string): string {
  return value.trim()
}
```

If the form stores an object but the API expects an ID:

```ts
protected getBusinessAssociateId(value: BusinessAssociateResource | null): string | null {
  return value?.id ?? null
}
```

### Composite Getters For Nested Properties

Composite getters are used for nested properties when no top-level field getter exists. They receive the nested value and return the payload value.

Naming scheme: `get${upperFirst(parentFieldKey)}${upperFirst(camelCase(propName))}`.

Example: if `positions` is an array of objects and each entry has a `product` resource, use a composite getter so the returned value is sent instead of the full `ProductResource`.

Before:

```ts
positions: [
  {
    product: {
      id: '123',
      name: 'Example'
    }
  }
]
```

After:

```ts
positions: [
  {
    product: '123'
  }
]
```

```ts
protected getPositionsProduct(value: ProductResource | null): number | null {
  return value?.id ?? null
}
```

The same rule applies to nested `PropertyAwareObject` fields. `buildPayload()` reconstructs the raw nested object and still uses composite getters for nested properties where defined.

### Appended Fields

Sometimes your server expects fields that don’t exist as a single input in the form. For example, the API may expect a `started_at` datetime, while the form has `start_date` and `start_time` fields. In this case, use an appended field.

Define a getter with the same naming scheme as a field getter. Because the field does not exist in the form state, the getter receives no parameters, but you can access other values via `this.state`. Then add the field name (snake_case) to `append`. `buildPayload()` will call the getter and append the computed value to the payload.

```ts
protected override append: string[] = ['started_at']

protected getStartedAt(): string {
  return DateTime.fromFormat(`${this.state.start_date} ${this.state.start_time}`, 'dd.MM.yyyy HH:mm').toISO()
}
```

## Ignoring Fields

You can exclude fields from the payload using `ignore`:

```ts
protected override ignore: string[] = ['internal_note']
```

Ignored fields are never added to the payload. This is especially useful with appended fields, where you can ignore the source fields (`start_date`, `start_time`) after computing a combined value like `started_at`.

## Omitting Fields

Omitting is similar to ignoring, but it is dynamic at runtime. If a getter returns `undefined`, that field is not added to the payload. If you return anything else, the field is included.

## Dates And Files

- `Date` values are treated as scalars and preserved.
- `File`/`Blob` values are treated as scalars and preserved. Send the payload using a multipart request.
