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
