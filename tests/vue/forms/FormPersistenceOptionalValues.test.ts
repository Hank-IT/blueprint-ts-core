import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { BaseForm, LocalStorageDriver, MemoryPersistenceDriver, SessionStorageDriver, type PersistedForm } from '../../../src/vue/forms'

interface Values {
  name: string
  note: string | null | undefined
  nested: { label: string | undefined; unused: string | undefined }
}

const values = (note: Values['note']): Values => ({ name: 'Original', note, nested: { label: 'Nested original', unused: undefined } })

describe.each([
  ['memory', () => new MemoryPersistenceDriver()],
  ['session storage', () => new SessionStorageDriver()],
  ['local storage', () => new LocalStorageDriver()]
] as const)('optional form values with %s', (_name, makeDriver) => {
  const key = 'optional-editor'
  class Editor extends BaseForm<Values, Values> {
    public constructor(initial = values('Original note')) {
      super(initial, { persist: true, persistKey: key })
    }
    protected override getPersistenceDriver() {
      return makeDriver()
    }
  }

  beforeEach(() => makeDriver().remove(key))
  afterEach(() => makeDriver().remove(key))

  it('restores a cleared optional field and unrelated edits, then resets to the loaded baseline', async () => {
    const editor = new Editor()
    editor.properties.name.model.value = 'Unsaved edit'
    editor.properties.note.model.value = undefined
    await nextTick()
    const draft = makeDriver().get<PersistedForm<Values>>(key)!
    expect(draft.state).not.toHaveProperty('note')
    expect(draft.original.note).toBe('Original note')
    expect(draft.touched.note).toBe(true)

    const reopened = new Editor()
    expect(reopened.properties.name.model.value).toBe('Unsaved edit')
    expect(reopened.properties.note.model.value).toBeUndefined()
    expect(reopened.isDirty('note')).toBe(true)
    expect(reopened.isTouched('note')).toBe(true)
    reopened.reset()
    expect(reopened.getStateSnapshot()).toEqual(values('Original note'))
    expect(reopened.isDirty()).toBe(false)
  })

  it('restores drafts whose initial values include undefined without marking those fields dirty', async () => {
    const editor = new Editor(values(undefined))
    editor.properties.name.model.value = 'Unsaved edit'
    await nextTick()
    const draft = makeDriver().get<PersistedForm<Values>>(key)!
    expect(draft.state).not.toHaveProperty('note')
    expect(draft.original).not.toHaveProperty('note')
    expect(draft.touched.note).toBe(false)

    const reopened = new Editor(values(undefined))
    expect(reopened.properties.name.model.value).toBe('Unsaved edit')
    expect(reopened.properties.note.model.value).toBeUndefined()
    expect(reopened.isDirty('note')).toBe(false)
    expect(reopened.isDirty('nested')).toBe(false)
    expect(reopened.isTouched('note')).toBe(false)
    reopened.reset()
    expect(reopened.getStateSnapshot()).toEqual(values(undefined))
    expect(reopened.isDirty()).toBe(false)
  })

  it('restores cleared nested values and accepts them as the next clean baseline', async () => {
    const editor = new Editor()
    editor.properties.nested.model.value.label = undefined
    await nextTick()
    const reopened = new Editor()
    expect(reopened.properties.nested.model.value).toEqual({ label: undefined, unused: undefined })
    expect(reopened.isDirty('nested')).toBe(true)
    reopened.acceptSavedValues()
    await nextTick()
    const savedValues = { ...values('Original note'), nested: { label: undefined, unused: undefined } }
    const saved = new Editor(savedValues)
    expect(saved.isDirty()).toBe(false)
    saved.properties.nested.model.value.label = 'Later edit'
    expect(saved.isDirty()).toBe(true)
    saved.reset()
    expect(saved.getStateSnapshot()).toEqual({ ...values('Original note'), nested: { label: undefined, unused: undefined } })
    expect(saved.isDirty()).toBe(false)
  })

  it.each([
    { initial: undefined, edited: null },
    { initial: null, edited: undefined }
  ])('preserves the difference between $initial and $edited', async ({ initial, edited }) => {
    const editor = new Editor(values(initial))
    editor.properties.note.model.value = edited
    await nextTick()
    const reopened = new Editor(values(initial))
    expect(reopened.properties.note.model.value).toBe(edited)
    expect(reopened.isDirty('note')).toBe(true)
    reopened.reset()
    expect(reopened.properties.note.model.value).toBe(initial)
    expect(reopened.isDirty()).toBe(false)
  })

  it('discards a draft when an omitted baseline value differs from the current initial value', async () => {
    const editor = new Editor(values(undefined))
    editor.properties.name.model.value = 'Unsaved edit'
    await nextTick()
    const reopened = new Editor(values('Changed on server'))
    expect(reopened.getStateSnapshot()).toEqual(values('Changed on server'))
    expect(reopened.isDirty()).toBe(false)
  })

  it('rejects missing touched metadata even when both stored values omit the field', async () => {
    const editor = new Editor(values(undefined))
    editor.properties.name.model.value = 'Unsaved edit'
    await nextTick()
    const draft = makeDriver().get<{ touched: Record<string, boolean> }>(key)!
    delete draft.touched['note']
    makeDriver().set(key, draft)
    expect(new Editor(values(undefined)).getStateSnapshot()).toEqual(values(undefined))
  })
})
