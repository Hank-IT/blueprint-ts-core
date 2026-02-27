# Arrays

## PropertyAwareArray

Use `PropertyAwareArray` for arrays with per-item `v-model`, errors, and dirty state when your array contains objects.

```ts
import { BaseForm, PropertyAwareArray } from '@blueprint-ts/core/vue/forms'

export interface FormWithPositions {
  positions: PositionItem[]
}

export class MyComplexForm extends BaseForm<RequestType, FormWithPositions> {
  constructor() {
    super({
      positions: new PropertyAwareArray([{ id: 1, value: '' }])
    })
  }

  public addPosition(): void {
    this.addToArrayProperty('positions', {
      id: this.properties.positions.length + 1,
      value: ''
    })
  }

  public removePosition(id: number): void {
    this.removeArrayItem('positions', (position) => position.id !== id)
    this.resetArrayCounter('positions', 'id')
  }
}
```

Example component usage:

```vue
<template>
  <div v-for="(position, index) in form.properties.positions" :key="index">
    <input v-model="position.value.model.value" />
    <div v-if="position.value.errors.length">{{ position.value.errors[0] }}</div>
    <div v-if="position.value.dirty">Changed</div>
  </div>
</template>
```

Nested error keys like `positions.0.value` map into `position.value.errors`.

## propertyAwareToRaw

`propertyAwareToRaw` converts a property-aware object (each field wrapped in `{ model: { value } }`) into a plain object by unwrapping every field's `model.value`. It is purely a transformation: metadata such as `errors`, `dirty`, and `touched` is dropped, while arrays and nested objects are processed recursively. Keys starting with `_` are omitted from the result, and arrays are mapped element-by-element via the same unwrapping.

### Input shape (property-aware)

```ts
const propertyAwarePosition = {
  id: {
    model: { value: 'pos-1' },
    errors: [],
    dirty: false,
    touched: false
  },
  sort_order: {
    model: { value: 10 },
    errors: [],
    dirty: false,
    touched: false
  },
  description: {
    model: { value: 'Service' },
    errors: [],
    dirty: false,
    touched: false
  },
  net_amount: {
    model: { value: 100 },
    errors: [],
    dirty: false,
    touched: false
  }
}
```

Note that this is only an example of how the input shape looks When used in a form the model is a WritableComputedRef.

### Output shape (raw)

```ts
const rawPosition = {
  id: 'pos-1',
  sort_order: 10,
  description: 'Service',
  net_amount: 100
}
```

### Notes

- Arrays are mapped element-by-element.
- Nested objects are unwrapped recursively.
- Any keys starting with `_` are ignored.
- Only the `model.value` remains; form metadata is dropped.
