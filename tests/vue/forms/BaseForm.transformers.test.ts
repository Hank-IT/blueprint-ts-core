import { describe, it, expect } from 'vitest'
import { BaseForm } from '../../../src/vue/forms/BaseForm'

type PositionsItem = { id: number; internal: string }

interface TestFormState {
  name: string
  email: string | null
  meta: { id: string; secret: string }
  positions: PositionsItem[]
  file: File | null
}

type TestRequestPayload = {
  name?: string
  email: string | null
  meta: { id: string }
  positions: Array<{ id: number }>
  file?: File
  started_at?: string
}

class TestForm extends BaseForm<TestRequestPayload, TestFormState> {
  protected override append: string[] = ['started_at']

  public constructor(overrides: Partial<TestFormState> = {}) {
    super({
      name: '',
      email: null,
      meta: { id: 'm1', secret: 'top-secret' },
      positions: [
        { id: 1, internal: 'x' },
        { id: 2, internal: 'y' },
      ],
      file: null,
      ...overrides,
    }, { persist: false })
  }

  // Field getter: omit name if empty by returning undefined.
  protected getName(value: string): string | undefined {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
  }

  // Composite getter: omit nested meta.secret by returning undefined.
  protected getMetaSecret(_value: string): undefined {
    return undefined
  }

  // Composite getter: omit positions[].internal by returning undefined.
  protected getPositionsInternal(_value: string): undefined {
    return undefined
  }

  // Appended getter: omit started_at by returning undefined.
  protected getStartedAt(): undefined {
    return undefined
  }
}

describe('BaseForm transformers / getters', () => {
  it('omits top-level fields when a field getter returns undefined', () => {
    const form = new TestForm({ name: '   ' })
    const payload = form.buildPayload()

    expect(Object.prototype.hasOwnProperty.call(payload, 'name')).toBe(false)
    expect(payload).toMatchObject({
      email: null,
    })
  })

  it('keeps null values (only undefined omits)', () => {
    const form = new TestForm({ name: 'Alice', email: null })
    const payload = form.buildPayload()

    expect(payload).toHaveProperty('name', 'Alice')
    expect(payload).toHaveProperty('email', null)
  })

  it('omits nested properties when a composite getter returns undefined', () => {
    const form = new TestForm({ name: 'Alice' })
    const payload = form.buildPayload()

    expect(payload.meta).toEqual({ id: 'm1' })
  })

  it('applies composite omission to arrays of objects', () => {
    const form = new TestForm({ name: 'Alice' })
    const payload = form.buildPayload()

    expect(payload.positions).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('omits appended fields when their getter returns undefined', () => {
    const form = new TestForm({ name: 'Alice' })
    const payload = form.buildPayload()

    expect(Object.prototype.hasOwnProperty.call(payload, 'started_at')).toBe(false)
  })

  it('keeps File values intact (does not transform into a plain object)', () => {
    const file = new File(['abc'], 'credentials.kdbx', { type: 'application/octet-stream' })
    const form = new TestForm({ name: 'Alice', file })
    const payload = form.buildPayload()

    expect(payload.file).toBe(file)
  })
})
