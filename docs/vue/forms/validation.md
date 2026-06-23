# Validation

Define validation rules by overriding `defineRules()` in your form class.

Validation errors are exposed on `properties.<field>.errors`, as documented in [Errors](/vue/forms/errors).

## Available Rules

- `RequiredRule` — checks that the value is not `null`, `undefined`, or `''`
- `MinRule` — minimum length for strings/arrays or minimum value for numbers
- `ConfirmedRule` — validates that two fields match (e.g. password confirmation)
- `UrlRule` — validates that the value is a valid URL
- `EmailRule` — validates that the value is a valid email address
- `JsonRule` — validates that the value is valid JSON

All rules are exported from `@blueprint-ts/core/vue/forms/validation`.

## Validation Modes

Validation modes are bit flags. You can use the presets below or combine flags with `|`.

**Flags**

- `ValidationMode.NEVER` — never validate this field
- `ValidationMode.INSTANTLY` — validate immediately when the field is evaluated, even if not dirty/touched
- `ValidationMode.ON_TOUCH` — validate after the field is touched
- `ValidationMode.ON_DIRTY` — validate when the field becomes dirty
- `ValidationMode.ON_SUBMIT` — validate on submit
- `ValidationMode.ON_DEPENDENT_CHANGE` — validate when a dependent field changes

**Presets**

- `ValidationMode.DEFAULT` — `ON_TOUCH | ON_DIRTY | ON_SUBMIT`
- `ValidationMode.AGGRESSIVE` — `INSTANTLY | ON_TOUCH | ON_DIRTY | ON_SUBMIT`
- `ValidationMode.PASSIVE` — `ON_SUBMIT`

**Custom Combination**

```ts
options: { mode: ValidationMode.ON_TOUCH | ValidationMode.ON_SUBMIT }
```

**Internal vs External**

- Internal means validation runs from within `BaseForm` based on user interaction or dependencies.
- External means you explicitly trigger validation via `validate(true)`, typically on submit.

- Internal triggers: `INSTANTLY`, `ON_TOUCH`, `ON_DIRTY`, `ON_DEPENDENT_CHANGE`
- External trigger (`validate(true)`): `ON_SUBMIT` (and `PASSIVE` preset)
- `NEVER` disables validation entirely

Rules can declare dependencies via `rule.dependsOn = ['otherField']`. Some rules, such as `ConfirmedRule`, automatically set up bidirectional dependencies.

## Externally Triggering Validation

```ts
const ok = form.validate(true)
if (!ok) return
```

Some modes (notably `PASSIVE` / `ON_SUBMIT`) only validate when you trigger validation manually.

### How `validate(isSubmitting)` Behaves

- `validate(true)` enables `ON_SUBMIT` rules. Fields with `PASSIVE` mode will validate only here.
- `validate(false)` still validates fields that are currently dirty, touched, or set to `INSTANTLY`.
- `ValidationMode.NEVER` prevents validation in all cases, even during submit.

## Validation Groups

Use validation groups when one form drives multiple tabs or wizard steps and you need to:

- validate only one section without clearing unrelated errors
- check whether a specific section currently has errors
- mark an entire section as touched

Define groups by overriding `defineValidationGroups()`:

```ts
import { type ValidationGroups } from '@blueprint-ts/core/vue/forms/validation'

protected override defineValidationGroups(): ValidationGroups<MyFormBody> {
  return {
    details: ['name', 'version', 'software_product_id', 'upload_session_id'],
    install: ['install_steps'],
    uninstall: ['uninstall_steps']
  }
}
```

Group members use prefix-subtree matching:

- `install_steps` matches `install_steps`
- `install_steps` also matches nested keys like `install_steps.0.payload.command`

### Validate Only One Group

```ts
const detailsValid = form.validateGroup('details', true)
if (!detailsValid) return
```

`validateGroup()` clears and recomputes errors only for that group. Errors outside the group are preserved.

### Check Whether a Group Has Errors

```ts
if (form.hasErrorsInGroup('install')) {
  // mark the install tab as invalid
}
```

This works with nested server-side validation errors such as `install_steps.0.payload.command`.

### Mark a Group as Touched

```ts
form.touchGroup('details')
```

This marks all top-level fields covered by the group as touched and triggers `ON_TOUCH` validation where applicable.

## Precognitive Rule

Blueprint ships `PrecognitiveRule` for Laravel Precognition flows.

The rule fits into normal `defineRules()` usage and accepts a request factory in its constructor:

```ts
import { BaseForm } from '@blueprint-ts/core/vue/forms'
import { PrecognitiveRule, ValidationMode, type ValidationRules } from '@blueprint-ts/core/vue/forms/validation'
import { CreatePackageRequest } from '@/requests/CreatePackageRequest'

interface PackageFormBody {
  name: string
  version: string
}

export class PackageForm extends BaseForm<PackageFormBody, PackageFormBody> {
  public constructor() {
    super({
      name: '',
      version: ''
    })
  }

  protected override defineRules(): ValidationRules<PackageFormBody> {
    return {
      name: {
        rules: [
          new PrecognitiveRule(() => new CreatePackageRequest(), {
            validateOnly: ['name', 'version']
          })
        ],
        options: { mode: ValidationMode.ON_TOUCH, asyncDebounceMs: 300 }
      }
    }
  }
}
```

### Running Async Validation

You can still call the async validation methods explicitly when you want to await the result:

```ts
await form.validateFieldAsync('name', { isSubmitting: true })
await form.validateGroupAsync('details', true)
await form.validateAsync(true)
```

The returned errors are merged into the normal form error bag, so field access stays the same:

```ts
form.properties.name.errors
form.getErrors()
form.getErrorsInGroup('details')
```

### How The Rule Works

`PrecognitiveRule` sends the current `buildPayload()` result with the standard Laravel Precognition headers:

- `Precognition: true`
- `Precognition-Validate-Only: field1,field2`

By default the rule validates only the current field. You can override this with `validateOnly` when the backend rule depends on multiple fields.

### Async Rules And Validation Modes

Async rules now honor the same `ValidationMode` flags as sync rules.

That means a field with async rules can be triggered automatically by:

- `ValidationMode.INSTANTLY`
- `ValidationMode.ON_TOUCH`
- `ValidationMode.ON_DIRTY`
- `ValidationMode.ON_DEPENDENT_CHANGE`

Use `asyncDebounceMs` when the async rule should not fire immediately on every update:

```ts
name: {
  rules: [new PrecognitiveRule(() => new CreatePackageRequest())],
  options: {
    mode: ValidationMode.INSTANTLY,
    asyncDebounceMs: 300
  }
}
```

`ValidationMode.ON_SUBMIT` also schedules async validation when submit-mode validation runs. If you need to await those remote results directly, use `validateAsync(true)` or `validateGroupAsync(group, true)`.

### Current Behavior

The current implementation supports:

- it can be triggered automatically by validation modes for field-level updates
- it can also be triggered explicitly by the async methods (`validateFieldAsync`, `validateGroupAsync`, `validateAsync`)
- it merges remote validation errors into the same form error bag used by local validation
- it keeps existing async errors visible until the latest remote check completes
- it ignores stale async responses when a newer validation run for the same field has already been scheduled

It does not currently provide:

- full request cancellation at the transport layer
- automatic async group orchestration beyond the existing `validateGroupAsync(...)` calls
- special UI state such as `isRemoteValidating`

## Typing `defineRules`

Use `ValidationRules<FormBody>` for a concise, strongly-typed return type:

```ts
import { type ValidationRules } from '@blueprint-ts/core/vue/forms/validation'

protected override defineRules(): ValidationRules<MyFormBody> {
  return {
    // ...
  }
}
```

## Custom Rules

Create your own rules by extending `BaseRule`:

```ts
import { BaseRule } from '@blueprint-ts/core/vue/forms/validation'

export class MaxRule<FormBody extends object> extends BaseRule<FormBody> {
  public constructor(
    protected max: number,
    protected message: string = 'Value is too large'
  ) {
    super()
  }

  public validate(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true
    }

    if (typeof value === 'string') {
      return value.length <= this.max
    }

    if (typeof value === 'number') {
      return value <= this.max
    }

    if (Array.isArray(value)) {
      return value.length <= this.max
    }

    return false
  }

  public getMessage(): string {
    return this.message
  }
}
```

If a rule depends on other fields, set `dependsOn` or implement bidirectional validation:

```ts
import { BaseRule } from '@blueprint-ts/core/vue/forms/validation'
import { type BidirectionalRule } from '@blueprint-ts/core/vue/forms/validation'

export class MatchesOtherRule<FormBody extends object> extends BaseRule<FormBody> implements BidirectionalRule {
  public dependsOn: Array<keyof FormBody> = ['other']

  public validate(value: unknown, state: FormBody): boolean {
    return value === state['other' as keyof FormBody]
  }

  public getMessage(): string {
    return 'Values do not match'
  }

  public getBidirectionalFields(): string[] {
    return ['other']
  }
}
```

## Example

```ts
import { BaseForm } from '@blueprint-ts/core/vue/forms'
import { ConfirmedRule, MinRule, RequiredRule, type ValidationRules } from '@blueprint-ts/core/vue/forms/validation'

export interface PinUpdateFormBody {
  current_pin: string
  new_pin: string
  new_pin_confirmation: string
}

export class PinUpdateForm extends BaseForm<PinUpdateFormBody, PinUpdateFormBody> {
  public constructor() {
    super({
      current_pin: '',
      new_pin: '',
      new_pin_confirmation: ''
    })
  }

  protected override defineRules(): ValidationRules<PinUpdateFormBody> {
    return {
      current_pin: {
        rules: [
          new RequiredRule('This field is required.'),
          new MinRule(4, 'This field must be at least 4 characters long.')
        ]
      },
      new_pin: {
        rules: [
          new RequiredRule('This field is required.'),
          new MinRule(4, 'This field must be at least 4 characters long.'),
          new ConfirmedRule('new_pin_confirmation', 'This field must match the confirmation.')
        ]
      },
      new_pin_confirmation: {
        rules: [new RequiredRule('This field is required.')]
      }
    }
  }
}
```
