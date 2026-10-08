import { describe, expect, it } from 'vitest'
import { BaseForm, PropertyAwareArray, PropertyAwareObject } from '../../../src/vue/forms'
import { ConfirmedRule, RequiredRule, ValidationMode, type ValidationGroups, type ValidationRules } from '../../../src/vue/forms/validation'

describe('BaseForm subclass extensions', () => {
  it('dispatches scalar, nested and dependent validation through the subclass hook', () => {
    interface Values {
      password: string
      confirmation: string
      profile: PropertyAwareObject<{ name: string }>
      contacts: PropertyAwareArray<{ name: string }>
    }
    type Context = NonNullable<Parameters<BaseForm<Values, Values>['validateFieldAsync']>[1]>
    const validations: Array<{ field: keyof Values; context: Context }> = []

    class Editor extends BaseForm<Values, Values> {
      public constructor() {
        super({
          password: 'initial',
          confirmation: 'initial',
          profile: new PropertyAwareObject({ name: 'Ada' }),
          contacts: new PropertyAwareArray([{ name: 'Grace' }])
        })
      }

      protected override defineRules(): ValidationRules<Values> {
        return {
          password: { rules: [new ConfirmedRule('confirmation')], options: { mode: ValidationMode.ON_DEPENDENT_CHANGE } },
          confirmation: { rules: [new ConfirmedRule('password')], options: { mode: ValidationMode.ON_DEPENDENT_CHANGE } }
        }
      }

      protected override validateField(field: keyof Values, context: Context = {}): void {
        validations.push({ field, context })
        super.validateField(field, context)
      }
    }

    const editor = new Editor()
    expect(validations.map(({ field }) => field)).toEqual(['password', 'confirmation'])
    validations.length = 0

    editor.properties.password.model.value = 'changed'
    expect(validations).toContainEqual({ field: 'password', context: {} })
    expect(validations).toContainEqual({ field: 'confirmation', context: { isDependentChange: true, isSubmitting: false } })
    expect(editor.getErrors()).toEqual({ password: ['Must match confirmation'], confirmation: ['Must match password'] })

    editor.properties.confirmation.model.value = 'changed'
    expect(editor.getErrors()).toEqual({})
    validations.length = 0

    editor.properties.profile.name.model.value = 'Katherine'
    editor.properties.contacts[0]!.name.model.value = 'Dorothy'
    expect(validations).toEqual([
      { field: 'profile', context: {} },
      { field: 'contacts', context: {} }
    ])
    expect(editor.isTouched('profile')).toBe(true)
    expect(editor.isTouched('contacts')).toBe(true)
    expect(editor.buildPayload()).toMatchObject({ profile: { name: 'Katherine' }, contacts: [{ name: 'Dorothy' }] })
  })

  it('uses validation rules and groups configured by the subclass after construction', () => {
    interface Values {
      name: string
      email: string
    }
    class Editor extends BaseForm<Values, Values> {
      protected override rules: ValidationRules<Values> = {
        name: { rules: [new RequiredRule('Name is required')], options: { mode: ValidationMode.PASSIVE } }
      }
      protected override validationGroups: ValidationGroups<Values> = { currentStep: ['name'] }

      public constructor() {
        super({ name: '', email: '' })
      }

      public showContactStep(): void {
        this.rules = { email: { rules: [new RequiredRule('Email is required')], options: { mode: ValidationMode.PASSIVE } } }
        this.validationGroups = { currentStep: ['email'] }
      }
    }

    const editor = new Editor()
    expect(editor.validateGroup('currentStep', true)).toBe(false)
    expect(editor.getErrors()).toEqual({ name: ['Name is required'] })
    editor.properties.name.model.value = 'Ada'
    expect(editor.validateGroup('currentStep', true)).toBe(true)

    editor.showContactStep()
    expect(editor.validateGroup('currentStep', true)).toBe(false)
    expect(editor.getErrorsInGroup('currentStep')).toEqual({ email: ['Email is required'] })
    editor.properties.email.model.value = 'ada@example.com'
    expect(editor.validateGroup('currentStep', true)).toBe(true)
    expect(editor.getErrors()).toEqual({})
  })

  it('binds payload getters to the form and reads current transformation settings', () => {
    interface Values {
      name: string
      meta: { code: string }
      private_note: string
    }
    interface Payload {
      name: string
      meta?: { code: string }
      summary?: string
    }
    class Editor extends BaseForm<Payload, Values> {
      protected override ignore = ['private_note']
      protected override append = ['summary']
      private prefix = 'user:'

      public constructor() {
        super({ name: ' Ada ', meta: { code: 'a' }, private_note: 'internal' })
      }

      protected getName(value: string): string {
        return this.prefix + value.trim()
      }

      protected getMetaCode(value: string): string {
        return this.prefix + value.toUpperCase()
      }

      protected getSummary(): string {
        return this.state.name.trim() + '/' + this.state.meta.code
      }

      public useCompactPayload(): void {
        this.prefix = 'compact:'
        this.ignore = ['private_note', 'meta']
        this.append = []
      }
    }

    const editor = new Editor()
    expect(editor.buildPayload()).toEqual({ name: 'user:Ada', meta: { code: 'user:A' }, summary: 'Ada/a' })
    editor.properties.name.model.value = ' Grace '
    expect(editor.buildPayload()).toEqual({ name: 'user:Grace', meta: { code: 'user:A' }, summary: 'Grace/a' })
    editor.useCompactPayload()
    expect(editor.buildPayload()).toEqual({ name: 'compact:Grace' })
    expect(editor.properties.name.model.value).toBe(' Grace ')
  })
})
