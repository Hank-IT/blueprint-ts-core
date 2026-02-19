# BaseForm Documentation

## Overview

`BaseForm` is a powerful and flexible TypeScript class for handling form state, validation, and submission in Vue
applications. It provides a comprehensive solution for managing form data with features like:

- Type-safe form state management
- Dirty + touched state tracking for fields
- Error handling, suggestions, and field validation
- Form persistence between page reloads
- Support for complex nested objects and arrays
- Automatic transformation of form values to API payloads

## Key Features

### 1. Type-Safe Form Management

The `BaseForm` is a generic class that takes two type parameters:

- `RequestBody`: The shape of the data that will be sent to the server
- `FormBody`: The shape of the form's internal state, which can differ from the request payload

````typescript
class MyForm extends BaseForm<MyRequestPayload, MyFormState> {
    // ...
}
````

### 2. Form State Persistence

Forms can automatically save their state to browser storage (session, local, etc.), allowing users to navigate away and
return without losing their input.

````typescript
protected override getPersistenceDriver(suffix?: string): PersistenceDriver {
  return new SessionStorageDriver(suffix) // Or LocalStorageDriver(suffix), etc.
}
````

Notes:
- Persistence is enabled by default. Disable it via `super(defaults, { persist: false })`.
- `persistSuffix` is passed into `getPersistenceDriver(suffix)` and is typically used to namespace the storage key.
- Persisted state is only reused if the stored `original` matches your current `defaults`; otherwise it is discarded.
- `persist: false` disables the automatic rehydration + background persistence, but some explicit mutation helpers (e.g. `fillState()`, `reset()`, `addToArrayProperty()`) still call the driver.

### 3. Transformations and Getters

Transform form values before they are sent to the server using getter methods:

````typescript
protected getStartedAt(): string {
    return DateTime.fromFormat(`${this.state.start_date} ${this.state.start_time}`, 'dd.MM.yyyy HH:mm').toISO()
}
````

### 4. Error Handling and Validation

Map server-side validation errors to specific form fields, with support for nested fields:

````typescript
protected override errorMap: { [serverKey: string]: string | string[] } = {
    started_at: ['start_date', 'start_time'],
    ended_at: ['end_date', 'end_time']
}
````

Validation is configured by overriding `defineRules()` and returning per-field rules and an optional validation mode:

- `ValidationMode.DEFAULT` (default): validates on dirty, touch, and submit
- `ValidationMode.PASSIVE`: only validates on submit
- `ValidationMode.AGGRESSIVE`: validates immediately and on all triggers
- `ValidationMode.ON_DEPENDENT_CHANGE`: revalidates when a dependency changes (see below)

Rules can declare dependencies via `rule.dependsOn = ['otherField']`. Some rules (e.g. `ConfirmedRule`) implement
bidirectional dependencies, so changing either field revalidates the other.

### 5. Array Management

Special support for arrays with the class `PropertyAwareArray`, enabling reactive updates to array items:

````typescript
public addPosition(): void {
    this.addToArrayProperty('positions', {
        index: this.properties.positions.length + 1,
        gross_amount: null,
        vat_rate: VatRateEnum.VAT_RATE_19,
        booking_account_category_id: null
    })
}
````

## Core Concepts

### State and Dirty Tracking

`BaseForm` tracks the original state and current state of each form field, automatically computing "dirty" status for
fields that have been changed.

````typescript
// Check if any field in the form has been modified
form.isDirty()

// Check if a specific field has been modified
form.isDirty('email')
````

### Touched Tracking

Touched indicates user interaction (or programmatic updates via setters/fill methods).

````typescript
form.touch('email')
form.isTouched('email')
````

### The Properties Object

The `properties` getter provides access to each form field with its model, errors, and dirty status:

````html

<template>
    <input v-model="form.properties.email.model.value" />
    <div v-if="form.properties.email.dirty">This field has been changed</div>
    <div v-if="form.properties.email.errors.length">{{ form.properties.email.errors[0] }}</div>
</template>
````

`properties.<field>` exposes:
- `model` (a `ComputedRef` compatible with `v-model`)
- `errors` (array; empty until validated/filled)
- `suggestions` (array/object list; populated via `fillSuggestions`)
- `dirty` and `touched`

### Form Submission

Build a payload for API submission with:

````typescript
const payload = form.buildPayload()
````

For validation on submit, call:

````typescript
const ok = form.validate(true)
if (!ok) return
await api.submitForm(form.buildPayload())
````

## How to Use

### 1. Create a Form Class

````typescript
import { BaseForm, type PersistenceDriver, SessionStorageDriver } from '@hank-it/ui/vue/forms'
import { RequiredRule, ValidationMode } from '@hank-it/ui/vue/forms/validation'

interface MyFormState {
    name: string
    email: string
}

interface MyRequestPayload {
    name: string
    email: string
    timestamp: string // Added field not in the form
}

class MyForm extends BaseForm<MyRequestPayload, MyFormState> {
    // Fields to add to the final payload that aren't in the form state
    protected override append: string[] = ['timestamp']

    // Fields to exclude from the final payload
    protected override ignore: string[] = []

    // Map server error keys to form field names
    protected override errorMap: { [serverKey: string]: string | string[] } = {}

    public constructor() {
        super({
          name: '',
          email: ''
        }, { persist: true, persistSuffix: 'optional-suffix' })
    }

    // Use session storage for persistence
    protected override getPersistenceDriver(suffix?: string): PersistenceDriver {
        return new SessionStorageDriver(suffix)
    }

    protected override defineRules() {
      return {
        name: { rules: [new RequiredRule<MyFormState>('Name is required')] },
        email: {
          rules: [new RequiredRule<MyFormState>('Email is required')],
          options: { mode: ValidationMode.DEFAULT }
        }
      }
    }

    // Generate a timestamp for the request
    protected getTimestamp(): string {
        return new Date().toISOString()
    }
}
````

### 2. Use in Components

````vue
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

<script setup>
import { MyForm } from './MyForm'

const form = new MyForm()

async function submitForm() {
  if (!form.validate(true)) return
  try {
    const payload = form.buildPayload()
    await api.submitForm(payload)
    // Success handling
  } catch (error) {
    if (error.response?.data?.errors) {
      form.fillErrors(error.response.data.errors)
    }
  }
}
</script>
````

## Working with Arrays
The `PropertyAwareArray` class enables special handling for array items. Each value of objects in the PropertyAwareArray will receive a v-model, errors, etc.:

````typescript
import { BaseForm, PropertyAwareArray } from '@hank-it/ui/vue/forms'

export interface FormWithPositions {
  // ...other fields
  positions: PositionItem[]
}

export class MyComplexForm extends BaseForm<RequestType, FormWithPositions> {
  constructor() {
    super({
      // ...other defaults
      positions: new PropertyAwareArray([
        { id: 1, value: '' }
      ])
    })
  }
  
  // Add a new position to the array
  public addPosition(): void {
    this.addToArrayProperty('positions', {
      id: this.properties.positions.length + 1,
      value: ''
    })
  }
  
  // Remove a position by id
  public removePosition(id: number): void {
    this.removeArrayItem('positions', (position) => position.id !== id)
    this.resetArrayCounter('positions', 'id')
  }
}

const form = new MyComplexForm()
const id = form.properties.positions[0].id.model.value
````

## Advanced Features
### 1. Form Reset
Revert all changes to the original state:

````typescript
form.reset()
````

### 2. Error Handling
Fill form with validation errors from a server response:

````typescript
try {
  await submitForm(form.buildPayload())
} catch (error) {
  form.fillErrors(error.response.data.errors)
}
````

`fillErrors` supports:
- direct field keys (e.g. `email`)
- array dot notation where the 2nd segment is a numeric index (e.g. `positions.0.value`)
- remapping via `errorMap` (including mapping one server key to multiple fields)

### 3. Filling Form State
Update multiple form fields at once and recompute dirty/touched accordingly:

````typescript
form.fillState({
  name: 'John Doe',
  email: 'john@example.com'
})
````

### 4. Synchronizing Values Without Marking Dirty
Update both the current and original state, keeping the field "clean":

````typescript
form.syncValue('email', 'new@example.com')
````

### 5. Suggestions
Provide per-field suggestions (exposed on `properties.<field>.suggestions`):

````typescript
form.fillSuggestions({ email: ['a@example.com', 'b@example.com'] })
````

### 6. Converting `properties` Back To Data
If you ever need a plain object from the `properties` tree (e.g. for debugging or integrating with non-`BaseForm` code),
use `propertyAwareToRaw`:

````typescript
import { propertyAwareToRaw } from '@hank-it/ui/vue/forms'

const raw = propertyAwareToRaw<MyFormState>(form.properties)
````

### 7. Checking For Errors

````typescript
form.hasErrors()
````

## Real-World Examples
### 1. Date/Time Handling

````typescript
export class TimeTrackingEntryCreateUpdateForm extends BaseForm<RequestPayload, FormState> {
  protected override append: string[] = ['started_at', 'ended_at']
  protected override ignore: string[] = ['start_date', 'start_time', 'end_date', 'end_time']
  
  protected getStartedAt(): string {
    return DateTime.fromFormat(`${this.state.start_date} ${this.state.start_time}`, 'dd.MM.yyyy HH:mm').toISO()
  }
  
  protected getEndedAt(): string {
    return DateTime.fromFormat(`${this.state.end_date} ${this.state.end_time}`, 'dd.MM.yyyy HH:mm').toISO()
  }
}
````

### 2. Complex Object Handling

If your form state contains nested objects, `buildPayload()` can transform individual nested properties via
composite getter names of the form `get<ParentField><NestedProp>()`, where:
- `ParentField` is based on the form field key (first character uppercased, not camel-cased)
- `NestedProp` is `upperFirst(camelCase(prop))`

Example (field key `businessAssociate`, prop `id`): `getBusinessAssociateId(...)`.

````typescript
export class IncomingVoucherCreateUpdateForm extends BaseForm<RequestPayload, FormState> {
  // Extract IDs from related objects
  protected getBusinessAssociateId(value: BusinessAssociateResource): string | null {
    return value?.id
  }
  
  protected getFileId(value: FileResource): string | null {
    return value?.id
  }
}
````
