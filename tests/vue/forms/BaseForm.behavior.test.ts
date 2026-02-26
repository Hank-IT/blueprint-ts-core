import { describe, it, expect } from 'vitest'
import { BaseForm, PropertyAwareArray } from '../../../src/vue/forms'
import { RequiredRule, ValidationMode, type ValidationRules } from '../../../src/vue/forms/validation'

interface TestFormState {
  name: string
  start_date: string
  start_time: string
  positions: PropertyAwareArray<{ value: string }>
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
})
