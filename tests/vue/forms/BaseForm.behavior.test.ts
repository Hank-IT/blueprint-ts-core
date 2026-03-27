import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseForm, PropertyAwareArray, PropertyAwareObject, SessionStorageDriver } from '../../../src/vue/forms'
import { PrecognitiveRule, RequiredRule, ValidationMode, type ValidationGroups, type ValidationRules } from '../../../src/vue/forms/validation'
import { BaseRequest } from '../../../src/requests/BaseRequest'
import { BaseResponse } from '../../../src/requests/responses/BaseResponse'
import { JsonBodyFactory } from '../../../src/requests/factories/JsonBodyFactory'
import { RequestMethodEnum } from '../../../src/requests/RequestMethod.enum'
import type { RequestDriverContract } from '../../../src/requests/contracts/RequestDriverContract'
import type { ResponseHandlerContract } from '../../../src/requests/drivers/contracts/ResponseHandlerContract'

interface TestFormState {
  name: string
  start_date: string
  start_time: string
  positions: PropertyAwareArray<{ value: string }>
}

interface NestedPayload {
  command: string
  interpreter: string
}

interface NestedStep {
  name: string
  payload: PropertyAwareObject<NestedPayload>
}

interface NestedFormState {
  payload: PropertyAwareObject<NestedPayload>
  steps: PropertyAwareArray<NestedStep>
}

interface NestedFormRequestBody {
  payload: NestedPayload
  steps: Array<{
    name: string
    payload: NestedPayload
  }>
}

interface AsyncFormState {
  name: string
  email: string
}

class BehaviorForm extends BaseForm<TestFormState, TestFormState> {
  protected override errorMap: { [serverKey: string]: string | string[] } = {
    started_at: ['start_date', 'start_time']
  }

  public constructor() {
    super(
      {
        name: '',
        start_date: '',
        start_time: '',
        positions: new PropertyAwareArray([{ value: 'a' }])
      },
      { persist: false }
    )
  }

  protected override defineRules(): ValidationRules<TestFormState> {
    return {
      name: {
        rules: [new RequiredRule('Required')],
        options: { mode: ValidationMode.PASSIVE }
      }
    }
  }

  protected override defineValidationGroups(): ValidationGroups<TestFormState> {
    return {
      details: ['name', 'start_date', 'start_time'],
      positions: ['positions']
    }
  }
}

class ReorderForm extends BaseForm<TestFormState, TestFormState> {
  public constructor() {
    super(
      {
        name: '',
        start_date: '',
        start_time: '',
        positions: new PropertyAwareArray([{ value: 'a' }, { value: 'b' }])
      },
      { persist: false }
    )
  }

  public reversePositions(): void {
    const positions = this.state.positions
    this.state.positions = new PropertyAwareArray([positions[1], positions[0]])
  }
}

class NestedBehaviorForm extends BaseForm<NestedFormRequestBody, NestedFormState> {
  public constructor() {
    super(
      {
        payload: new PropertyAwareObject({
          command: '',
          interpreter: 'powershell'
        }),
        steps: new PropertyAwareArray([
          {
            name: 'first',
            payload: new PropertyAwareObject({
              command: '',
              interpreter: 'bash'
            })
          }
        ])
      },
      { persist: false }
    )
  }
}

class NestedBehaviorTwoStepForm extends BaseForm<NestedFormRequestBody, NestedFormState> {
  public constructor() {
    super(
      {
        payload: new PropertyAwareObject({
          command: '',
          interpreter: 'powershell'
        }),
        steps: new PropertyAwareArray([
          {
            name: 'first',
            payload: new PropertyAwareObject({
              command: '',
              interpreter: 'bash'
            })
          },
          {
            name: 'second',
            payload: new PropertyAwareObject({
              command: '',
              interpreter: 'bash'
            })
          }
        ])
      },
      { persist: false }
    )
  }
}

class PersistentNestedBehaviorForm extends BaseForm<NestedFormRequestBody, NestedFormState> {
  public constructor() {
    super(
      {
        payload: new PropertyAwareObject({
          command: '',
          interpreter: 'powershell'
        }),
        steps: new PropertyAwareArray([])
      },
      { persist: true, persistSuffix: 'nested-persistence-test' }
    )
  }

  protected override getPersistenceDriver(suffix: string | undefined): SessionStorageDriver {
    return new SessionStorageDriver(suffix)
  }

  public addStep(): void {
    this.fillState({
      steps: new PropertyAwareArray([
        {
          name: 'persisted-step',
          payload: new PropertyAwareObject({
            command: 'echo persisted',
            interpreter: 'bash'
          })
        }
      ])
    })
  }
}

class AsyncValidationResponse extends BaseResponse<undefined> {
  public getAcceptHeader(): string {
    return 'application/json'
  }

  protected resolveBody(): Promise<undefined> {
    return Promise.resolve(undefined)
  }
}

class AsyncValidationRequest extends BaseRequest<
  unknown,
  { errors?: Record<string, string[]> },
  undefined,
  AsyncValidationResponse,
  AsyncFormState,
  object
> {
  public method(): RequestMethodEnum {
    return RequestMethodEnum.POST
  }

  public url(): string {
    return '/precognition'
  }

  public getResponse(): AsyncValidationResponse {
    return new AsyncValidationResponse()
  }

  public getRequestBodyFactory(): JsonBodyFactory<AsyncFormState> {
    return new JsonBodyFactory<AsyncFormState>()
  }
}

class AsyncBehaviorForm extends BaseForm<AsyncFormState, AsyncFormState> {
  public constructor() {
    super(
      {
        name: '',
        email: ''
      },
      { persist: false }
    )
  }

  protected override defineRules(): ValidationRules<AsyncFormState> {
    return {
      name: {
        rules: [new PrecognitiveRule(() => new AsyncValidationRequest())],
        options: { mode: ValidationMode.PASSIVE }
      },
      email: {
        rules: [new RequiredRule('Email is required')],
        options: { mode: ValidationMode.PASSIVE }
      }
    }
  }

  protected override defineValidationGroups(): ValidationGroups<AsyncFormState> {
    return {
      details: ['name'],
      contact: ['email']
    }
  }
}

class InstantAsyncBehaviorForm extends BaseForm<AsyncFormState, AsyncFormState> {
  public constructor() {
    super(
      {
        name: '',
        email: ''
      },
      { persist: false }
    )
  }

  protected override defineRules(): ValidationRules<AsyncFormState> {
    return {
      name: {
        rules: [new PrecognitiveRule(() => new AsyncValidationRequest())],
        options: { mode: ValidationMode.INSTANTLY, asyncDebounceMs: 50 }
      }
    }
  }
}

class TouchAsyncBehaviorForm extends BaseForm<AsyncFormState, AsyncFormState> {
  public constructor() {
    super(
      {
        name: '',
        email: ''
      },
      { persist: false }
    )
  }

  protected override defineRules(): ValidationRules<AsyncFormState> {
    return {
      name: {
        rules: [new PrecognitiveRule(() => new AsyncValidationRequest())],
        options: { mode: ValidationMode.ON_TOUCH }
      }
    }
  }
}

function createJsonResponseHandler(statusCode: number, body: Record<string, unknown>): ResponseHandlerContract {
  return {
    getStatusCode: () => statusCode,
    getHeaders: () => ({}),
    getRawResponse: () => new Response(JSON.stringify(body), { status: statusCode }),
    json: async <T>() => body as T,
    text: async () => JSON.stringify(body),
    blob: async () => new Blob([JSON.stringify(body)], { type: 'application/json' })
  }
}

function createEmptyResponseHandler(statusCode: number): ResponseHandlerContract {
  return {
    getStatusCode: () => statusCode,
    getHeaders: () => ({}),
    getRawResponse: () => new Response(null, { status: statusCode }),
    json: async <T>() => undefined as T,
    text: async () => '',
    blob: async () => new Blob()
  }
}

describe('BaseForm behavior', () => {
  beforeEach(() => {
    BaseRequest.setDefaultBaseUrl('https://example.com')
    BaseRequest.setRequestDriver({
      send: vi.fn().mockResolvedValue(createEmptyResponseHandler(204))
    })
  })

  it('tracks dirty and touched on simple fields', () => {
    const form = new BehaviorForm()

    expect(form.isDirty('name')).toBe(false)
    expect(form.isTouched('name')).toBe(false)

    form.properties.name.model.value = 'Alice'

    expect(form.isDirty('name')).toBe(true)
    expect(form.isTouched('name')).toBe(true)
  })

  it('tracks dirty state for PropertyAwareArray items', () => {
    const form = new BehaviorForm()

    const first = form.properties.positions[0]
    expect(first.value.model.value).toBe('a')

    first.value.model.value = 'b'

    expect(form.properties.positions[0].value.dirty).toBe(true)
    expect(form.isDirty('positions')).toBe(true)
  })

  it('preserves PropertyAwareArray item wrapper identity across accesses and reorder', () => {
    const form = new ReorderForm()

    const firstAccess = form.properties.positions[0]
    const secondAccess = form.properties.positions[0]

    expect(firstAccess).toBe(secondAccess)

    const originalFirst = form.properties.positions[0]
    const originalSecond = form.properties.positions[1]

    form.reversePositions()

    expect(form.properties.positions[0]).toBe(originalSecond)
    expect(form.properties.positions[1]).toBe(originalFirst)
  })

  it('maps external errors to fields and array items', () => {
    const form = new BehaviorForm()

    form.fillErrors({
      name: ['Required'],
      'positions.0.value': ['Invalid'],
      started_at: ['Bad datetime']
    })

    expect(form.properties.name.errors).toEqual(['Required'])
    expect(form.properties.positions[0].value.errors).toEqual(['Invalid'])
    expect(form.properties.start_date.errors).toEqual(['Bad datetime'])
    expect(form.properties.start_time.errors).toEqual(['Bad datetime'])
  })

  it('overwrites existing errors when fillErrors is called again', () => {
    const form = new BehaviorForm()

    form.fillErrors({ name: ['First'] })
    form.fillErrors({ name: ['Second'] })

    expect(form.properties.name.errors).toEqual(['Second'])
  })

  it('does not validate PASSIVE rules until validate(true) is called', () => {
    const form = new BehaviorForm()

    form.properties.name.model.value = ''
    expect(form.properties.name.errors).toEqual([])

    const ok = form.validate(true)
    expect(ok).toBe(false)
    expect(form.properties.name.errors.length).toBeGreaterThan(0)
  })

  it('validates only the targeted group and preserves unrelated errors', () => {
    const form = new BehaviorForm()

    form.fillErrors({
      'positions.0.value': ['Invalid position']
    })

    const ok = form.validateGroup('details', true)

    expect(ok).toBe(false)
    expect(form.properties.name.errors).toEqual(['Required'])
    expect(form.properties.positions[0].value.errors).toEqual(['Invalid position'])
    expect(form.hasErrorsInGroup('details')).toBe(true)
    expect(form.hasErrorsInGroup('positions')).toBe(true)
  })

  it('detects nested errors within a validation group', () => {
    const form = new BehaviorForm()

    form.fillErrors({
      'positions.0.value': ['Invalid position']
    })

    expect(form.hasErrorsInGroup('positions')).toBe(true)
    expect(form.hasErrorsInGroup('details')).toBe(false)
    expect(form.getErrors()).toEqual({
      'positions.0.value': ['Invalid position']
    })
    expect(form.getErrorsInGroup('positions')).toEqual({
      'positions.0.value': ['Invalid position']
    })
    expect(form.getErrorsInGroup('details')).toEqual({})
  })

  it('touches all fields in a validation group', () => {
    const form = new BehaviorForm()

    form.touchGroup('details')

    expect(form.isTouched('name')).toBe(true)
    expect(form.isTouched('start_date')).toBe(true)
    expect(form.isTouched('start_time')).toBe(true)
    expect(form.isTouched('positions')).toBe(false)
  })

  it('exposes PropertyAwareObject nested fields and rebuilds nested payloads', () => {
    const form = new NestedBehaviorForm()

    expect(form.properties.payload.command.model.value).toBe('')
    expect(form.properties.steps[0].payload.command.model.value).toBe('')

    form.properties.payload.command.model.value = 'top'
    form.properties.steps[0].payload.command.model.value = 'nested'

    expect(form.buildPayload()).toEqual({
      payload: {
        command: 'top',
        interpreter: 'powershell'
      },
      steps: [
        {
          name: 'first',
          payload: {
            command: 'nested',
            interpreter: 'bash'
          }
        }
      ]
    })
  })

  it('maps nested PropertyAwareObject errors for direct fields and array items', () => {
    const form = new NestedBehaviorForm()

    form.fillErrors({
      'payload.command': ['Top level required'],
      'steps.0.payload.command': ['Step command required']
    })

    expect(form.properties.payload.command.errors).toEqual(['Top level required'])
    expect(form.properties.steps[0].payload.command.errors).toEqual(['Step command required'])
  })

  it('tracks dirty state for nested PropertyAwareObject fields', () => {
    const form = new NestedBehaviorForm()

    expect(form.properties.steps[0].payload.command.dirty).toBe(false)

    form.properties.steps[0].payload.command.model.value = 'changed'

    expect(form.properties.steps[0].payload.command.dirty).toBe(true)
    expect(form.isDirty('steps')).toBe(true)
  })

  it('clears only the edited nested array-item error path and preserves sibling errors', () => {
    const form = new NestedBehaviorTwoStepForm()

    form.fillErrors({
      'steps.0.payload.command': ['First step command required'],
      'steps.1.payload.command': ['Second step command required']
    })

    form.properties.steps[0].payload.command.model.value = 'fixed'

    expect(form.properties.steps[0].payload.command.errors).toEqual([])
    expect(form.properties.steps[1].payload.command.errors).toEqual(['Second step command required'])
  })

  it('clears only the edited nested object error path and preserves sibling errors', () => {
    const form = new NestedBehaviorForm()

    form.fillErrors({
      'payload.command': ['Top level command required'],
      'payload.interpreter': ['Interpreter required']
    })

    form.properties.payload.command.model.value = 'fixed'

    expect(form.properties.payload.command.errors).toEqual([])
    expect(form.properties.payload.interpreter.errors).toEqual(['Interpreter required'])
  })

  it('restores persisted PropertyAwareObject fields inside PropertyAwareArray items', () => {
    sessionStorage.clear()

    const initialForm = new PersistentNestedBehaviorForm()
    initialForm.addStep()

    const restoredForm = new PersistentNestedBehaviorForm()

    expect(restoredForm.properties.steps).toHaveLength(1)
    expect(restoredForm.properties.steps[0].payload.command.model.value).toBe('echo persisted')
    expect(restoredForm.properties.steps[0].payload.interpreter.model.value).toBe('bash')

    sessionStorage.clear()
  })

  it('runs Precognitive rules asynchronously and clears only targeted async errors on success', async () => {
    const driver: RequestDriverContract = {
      send: vi
        .fn()
        .mockResolvedValueOnce(createJsonResponseHandler(422, { errors: { name: ['Name is already taken'] } }))
        .mockResolvedValueOnce(createEmptyResponseHandler(204))
    }

    BaseRequest.setRequestDriver(driver)

    const form = new AsyncBehaviorForm()
    form.fillErrors({
      email: ['Email is invalid']
    })

    await form.validateFieldAsync('name', { isSubmitting: true })

    const [, , firstHeaders, firstBody] = (driver.send as ReturnType<typeof vi.fn>).mock.calls[0]

    expect(firstHeaders).toMatchObject({
      Accept: 'application/json',
      Precognition: 'true',
      'Precognition-Validate-Only': 'name'
    })
    expect(firstBody?.getContent()).toBe('{"name":"","email":""}')
    expect(form.properties.name.errors).toEqual(['Name is already taken'])
    expect(form.properties.email.errors).toEqual(['Email is invalid'])

    form.properties.name.model.value = 'Ada'

    await form.validateFieldAsync('name', { isSubmitting: true })

    expect(form.properties.name.errors).toEqual([])
    expect(form.properties.email.errors).toEqual(['Email is invalid'])
  })

  it('keeps existing async errors visible while Precognitive validation is in flight', async () => {
    let resolvePendingResponse: ((value: ResponseHandlerContract) => void) | null = null

    const driver: RequestDriverContract = {
      send: vi
        .fn()
        .mockResolvedValueOnce(createJsonResponseHandler(422, { errors: { name: ['Name is already taken'] } }))
        .mockImplementationOnce(
          () =>
            new Promise<ResponseHandlerContract>((resolve) => {
              resolvePendingResponse = resolve
            })
        )
    }

    BaseRequest.setRequestDriver(driver)

    const form = new AsyncBehaviorForm()

    await form.validateFieldAsync('name', { isSubmitting: true })
    expect(form.properties.name.errors).toEqual(['Name is already taken'])

    form.properties.name.model.value = 'Ada'

    const pendingValidation = form.validateFieldAsync('name', { isSubmitting: true })

    expect(form.properties.name.errors).toEqual(['Name is already taken'])

    resolvePendingResponse?.(createEmptyResponseHandler(204))
    await pendingValidation

    expect(form.properties.name.errors).toEqual([])
  })

  it('validates only the targeted group asynchronously', async () => {
    const driver: RequestDriverContract = {
      send: vi.fn().mockResolvedValue(createJsonResponseHandler(422, { errors: { name: ['Remote name error'] } }))
    }

    BaseRequest.setRequestDriver(driver)

    const form = new AsyncBehaviorForm()
    form.fillErrors({
      email: ['Email is invalid']
    })

    const ok = await form.validateGroupAsync('details', true)

    expect(ok).toBe(false)
    expect(form.getErrorsInGroup('details')).toEqual({
      name: ['Remote name error']
    })
    expect(form.getErrorsInGroup('contact')).toEqual({
      email: ['Email is invalid']
    })
  })

  it('automatically runs async validation for instantly validated fields with debounce', async () => {
    vi.useFakeTimers()

    try {
      const driver: RequestDriverContract = {
        send: vi.fn().mockResolvedValue(createEmptyResponseHandler(204))
      }

      BaseRequest.setRequestDriver(driver)

      const form = new InstantAsyncBehaviorForm()
      form.properties.name.model.value = 'Ada'

      expect(driver.send).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(49)
      expect(driver.send).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(driver.send).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('automatically runs async validation for touch-validated fields when touched', async () => {
    const driver: RequestDriverContract = {
      send: vi.fn().mockResolvedValue(createEmptyResponseHandler(204))
    }

    BaseRequest.setRequestDriver(driver)

    const form = new TouchAsyncBehaviorForm()
    form.touch('name')

    await Promise.resolve()

    expect(driver.send).toHaveBeenCalledTimes(1)
  })
})
