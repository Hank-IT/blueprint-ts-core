import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseForm } from '../../../src/vue/forms'
import { PrecognitiveRule, RequiredRule, ValidationMode, type ValidationRules } from '../../../src/vue/forms/validation'
import {
  BaseRequest,
  JsonBodyFactory,
  JsonResponse,
  RequestMethodEnum,
  deferredResponse,
  emptyResponse,
  installMockRequestDriver,
  matchHeaders,
  validationError
} from '../../../src/requests'

interface Values {
  name: string
  email: string
}
class ValidateRequest extends BaseRequest<unknown, { errors?: Record<string, string[]> }, object, JsonResponse<object>, Values> {
  public method() {
    return RequestMethodEnum.POST
  }
  public url() {
    return '/validate'
  }
  public getResponse() {
    return new JsonResponse<object>()
  }
  public override getRequestBodyFactory() {
    return new JsonBodyFactory<Values>()
  }
}
class Editor extends BaseForm<Values, Values> {
  public constructor() {
    super({ name: 'loaded', email: '' }, { persist: false })
  }
  protected override defineRules(): ValidationRules<Values> {
    return {
      name: { rules: [new PrecognitiveRule(() => new ValidateRequest())], options: { mode: ValidationMode.PASSIVE } },
      email: { rules: [new RequiredRule('Email is required')], options: { mode: ValidationMode.PASSIVE } }
    }
  }
}
const criteria = {
  method: RequestMethodEnum.POST,
  url: 'https://example.com/validate',
  headers: matchHeaders({ Precognition: 'true', 'Precognition-Validate-Only': 'name', 'Content-Type': 'application/json' })
}

describe('form async validation through the request driver', () => {
  beforeEach(() => BaseRequest.getDefaultClient().setBaseUrl('https://example.com'))

  it('combines synchronous and server validation, then clears both after correcting the values', async () => {
    const driver = installMockRequestDriver()
    const editor = new Editor()
    editor.properties.name.model.value = 'duplicate'
    driver.expect({ ...criteria, body: { name: 'duplicate', email: '' }, response: validationError({ name: ['Already taken'] }) })
    await expect(editor.validateAsync(true)).resolves.toBe(false)
    expect(editor.getErrors()).toEqual({ name: ['Already taken'], email: ['Email is required'] })
    editor.properties.name.model.value = 'available'
    editor.properties.email.model.value = 'ada@example.com'
    driver.expect({ ...criteria, body: { name: 'available', email: 'ada@example.com' }, response: emptyResponse() })
    await expect(editor.validateAsync(true)).resolves.toBe(true)
    expect(editor.getErrors()).toEqual({})
    expect(editor.isDirty()).toBe(true)
    driver.assertExpectationsMet()
  })

  it('uses subclass validation and payload overrides for group and field requests', async () => {
    type Context = NonNullable<Parameters<Editor['validateFieldAsync']>[1]>
    const validatedFields: Array<keyof Values> = []
    class CustomizedEditor extends Editor {
      protected override defineValidationGroups() {
        return { details: ['name'] }
      }

      protected override validateField(field: keyof Values, context: Context = {}): void {
        validatedFields.push(field)
        super.validateField(field, context)
      }

      public override buildPayload(): Values {
        const values = super.buildPayload()
        return { ...values, name: `user:${values.name}` }
      }
    }

    const driver = installMockRequestDriver()
    const editor = new CustomizedEditor()
    editor.properties.name.model.value = 'duplicate'
    validatedFields.length = 0
    driver.expect({ ...criteria, body: { name: 'user:duplicate', email: '' }, response: validationError({ name: ['Already taken'] }) })
    await expect(editor.validateGroupAsync('details', true)).resolves.toBe(false)
    expect(validatedFields).toEqual(['name'])
    expect(editor.getErrors()).toEqual({ name: ['Already taken'] })

    editor.properties.name.model.value = 'available'
    validatedFields.length = 0
    driver.expect({ ...criteria, body: { name: 'user:available', email: '' }, response: emptyResponse() })
    await expect(editor.validateFieldAsync('name', { isSubmitting: true })).resolves.toBe(true)
    expect(validatedFields).toEqual(['name'])
    expect(editor.getErrors()).toEqual({})
    driver.assertExpectationsMet()
  })

  it.each([true, false])('keeps the latest validation result when an older response arrives last (latest valid: %s)', async (latestValid) => {
    const driver = installMockRequestDriver()
    const first = deferredResponse()
    const second = deferredResponse()
    driver.expect({ ...criteria, body: { name: 'first edit', email: '' }, response: first.respond })
    driver.expect({ ...criteria, body: { name: 'second edit', email: '' }, response: second.respond })
    const editor = new Editor()
    editor.properties.name.model.value = 'first edit'
    const firstValidation = editor.validateFieldAsync('name')
    await vi.waitFor(() => expect(driver.getHistory()).toHaveLength(1))
    editor.properties.name.model.value = 'second edit'
    const secondValidation = editor.validateFieldAsync('name')
    await vi.waitFor(() => expect(driver.getHistory()).toHaveLength(2))
    second.resolve(latestValid ? emptyResponse() : validationError({ name: ['Latest error'] }))
    await expect(secondValidation).resolves.toBe(latestValid)
    first.resolve(latestValid ? validationError({ name: ['Obsolete error'] }) : emptyResponse())
    await firstValidation
    expect(editor.properties.name.errors).toEqual(latestValid ? [] : ['Latest error'])
    expect(editor.properties.name.model.value).toBe('second edit')
    driver.assertExpectationsMet()
  })
})
