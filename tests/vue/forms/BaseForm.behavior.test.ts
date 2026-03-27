import { describe, it, expect } from 'vitest'
import { BaseForm, PropertyAwareArray, PropertyAwareObject, SessionStorageDriver } from '../../../src/vue/forms'
import { RequiredRule, ValidationMode, type ValidationGroups, type ValidationRules } from '../../../src/vue/forms/validation'

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

describe('BaseForm behavior', () => {
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
})
