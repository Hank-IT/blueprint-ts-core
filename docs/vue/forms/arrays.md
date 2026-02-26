# Arrays

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
