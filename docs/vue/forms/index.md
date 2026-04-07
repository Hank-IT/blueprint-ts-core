# BaseForm

`BaseForm` is a TypeScript base class for Vue forms that gives you:
- Type-safe form state
- Dirty and touched tracking
- Validation and error mapping
- Payload transformations
- Optional persistence
- Array helpers and file handling
- Stable property-aware array item wrappers for reorderable UIs
- Opt-in nested object fields via `PropertyAwareObject`

When a form uses persistence, you can keep browser-backed drivers such as `SessionStorageDriver` in production and swap
to `MemoryPersistenceDriver` in tests so draft restore behavior can be asserted without touching browser storage. See
[Persistence](/vue/forms/persistence) for the persistence lifecycle, restore policy, and testing setup.

**Getting Started**

Minimal form class:

```ts
import { BaseForm, type PersistenceDriver, SessionStorageDriver } from '@blueprint-ts/core/vue/forms'
import { RequiredRule, ValidationMode } from '@blueprint-ts/core/vue/forms/validation'

interface FormState {
  name: string
  email: string
}

interface RequestPayload {
  name: string
  email: string
  timestamp: string
}

export class MyForm extends BaseForm<RequestPayload, FormState> {
  protected override append: string[] = ['timestamp']
  protected override ignore: string[] = []
  protected override errorMap: { [serverKey: string]: string | string[] } = {}

  public constructor() {
    super(
      { name: '', email: '' },
      { persist: true, persistSuffix: 'optional-suffix' }
    )
  }

  protected override getPersistenceDriver(suffix?: string): PersistenceDriver {
    return new SessionStorageDriver(suffix)
  }

  protected override defineRules() {
    return {
      name: { rules: [new RequiredRule<FormState>('Name is required')] },
      email: {
        rules: [new RequiredRule<FormState>('Email is required')],
        options: { mode: ValidationMode.DEFAULT }
      }
    }
  }

  protected getTimestamp(): string {
    return new Date().toISOString()
  }
}
```

Component usage:

```vue
<template>
  <form @submit.prevent="submitForm">
    <div>
      <label>Name</label>
      <input v-model="form.properties.name.model.value" />
      <div v-if="form.properties.name.errors.length" class="error">
        {{ form.properties.name.errors[0] }}
      </div>
    </div>

    <div>
      <label>Email</label>
      <input v-model="form.properties.email.model.value" />
      <div v-if="form.properties.email.errors.length" class="error">
        {{ form.properties.email.errors[0] }}
      </div>
    </div>

    <button type="submit" :disabled="!form.isDirty()">Submit</button>
    <button type="button" @click="form.reset()">Reset</button>
  </form>
</template>

<script setup lang="ts">
import { MyForm } from './MyForm'

const form = new MyForm()

async function submitForm() {
  if (!form.validate(true)) return
  const payload = form.buildPayload()
  await api.submitForm(payload)
}
</script>
```
