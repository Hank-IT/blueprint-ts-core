import { beforeEach, describe, expect, it } from 'vitest'
import { computed, nextTick, watch } from 'vue'
import {
  BaseForm,
  MemoryPersistenceDriver,
  PropertyAwareArray,
  type BaseFormOptions,
  type PersistedForm,
  type PersistenceRestorePolicy
} from '../../../src/vue/forms'

interface Values {
  name: string
  nested: { enabled: boolean }
  items: PropertyAwareArray<{ id: string }>
  file: File | null
}
const values = (name = 'loaded'): Values => ({ name, nested: { enabled: false }, items: new PropertyAwareArray([{ id: 'a' }]), file: null })
class Editor extends BaseForm<Values, Values> {
  public constructor(initial = values(), options: BaseFormOptions = {}) {
    super(initial, { persistKey: 'editor', ...options })
  }
  protected override getPersistenceDriver() {
    return new MemoryPersistenceDriver()
  }
}

describe('form baselines', () => {
  beforeEach(() => MemoryPersistenceDriver.clear())

  it('starts clean, detects nested edits immediately, and resets to its initial values', () => {
    const editor = new Editor()
    const dirty = computed(() => editor.isDirty())
    expect(dirty.value).toBe(false)
    editor.properties.nested.model.value.enabled = true
    expect(dirty.value).toBe(true)
    editor.reset()
    expect(dirty.value).toBe(false)
    expect(editor.getStateSnapshot()).toEqual(values())
  })

  it.each(['current', 'supplied'])('accepts %s values as the clean baseline for subsequent edits and reset', (source) => {
    const editor = new Editor()
    const dirty = computed(() => editor.isDirty())
    const fieldDirty = computed(() => editor.properties.name.dirty)
    for (const name of ['first', 'second']) {
      editor.properties.name.model.value = name
      expect(dirty.value).toBe(true)
      expect(fieldDirty.value).toBe(true)
      editor.acceptSavedValues(source === 'current' ? undefined : values(name))
      expect(dirty.value).toBe(false)
      expect(fieldDirty.value).toBe(false)
      expect(editor.isTouched('name')).toBe(false)
    }
    editor.properties.name.model.value = 'unsaved'
    editor.reset()
    expect(editor.properties.name.model.value).toBe('second')
  })

  it('copies current nested values into the baseline without replacing files or array wrappers', () => {
    const file = new File(['payload'], 'file.bin')
    const editor = new Editor({ ...values(), file })
    editor.properties.nested.model.value.enabled = true
    editor.acceptSavedValues()
    expect(editor.isDirty()).toBe(false)
    editor.properties.nested.model.value.enabled = false
    expect(editor.isDirty()).toBe(true)
    editor.reset()
    expect(editor.getStateSnapshot()).toEqual({ ...values(), nested: { enabled: true }, file })
    expect(editor.getStateSnapshot().file).toBe(file)
    expect(editor.getStateSnapshot().items).toBeInstanceOf(PropertyAwareArray)
  })

  it('applies normalized saved values and preserves files and array wrappers', () => {
    const file = new File(['payload'], 'file.bin')
    const editor = new Editor({ ...values(), file })
    editor.properties.name.model.value = ' name '
    editor.acceptSavedValues({ ...values('name'), file })
    expect(editor.getStateSnapshot()).toEqual({ ...values('name'), file })
    expect(editor.getStateSnapshot().file).toBe(file)
    expect(editor.getStateSnapshot().items).toBeInstanceOf(PropertyAwareArray)
    expect(editor.isDirty()).toBe(false)
  })

  it('does not notify selection watchers when saved values are unchanged', async () => {
    const editor = new Editor()
    const selected = editor.properties.nested.model.value
    const calls: boolean[] = []
    const stop = watch(
      () => editor.properties.nested.model.value.enabled,
      (value) => calls.push(value)
    )
    editor.acceptSavedValues(values())
    await nextTick()
    expect(editor.properties.nested.model.value).toBe(selected)
    expect(calls).toEqual([])
    stop()
  })

  it('supports a local storage save without a request client', () => {
    const editor = new Editor()
    editor.properties.name.model.value = 'local'
    localStorage.setItem('saved-form', JSON.stringify(editor.buildPayload()))
    editor.acceptSavedValues()
    expect(JSON.parse(localStorage.getItem('saved-form')!).name).toBe('local')
    expect(editor.isDirty()).toBe(false)
    localStorage.removeItem('saved-form')
  })

  it('keeps the baseline unchanged when the caller cannot save', () => {
    const editor = new Editor()
    editor.properties.name.model.value = 'unsaved'
    const save = () => {
      throw new Error('storage unavailable')
    }
    expect(save).toThrow('storage unavailable')
    expect(editor.isDirty()).toBe(true)
    editor.reset()
    expect(editor.properties.name.model.value).toBe('loaded')
  })

  it('restores unversioned drafts and recalculates dirty state', async () => {
    const editor = new Editor(values(), { persist: true })
    editor.properties.name.model.value = 'draft'
    await nextTick()
    const driver = new MemoryPersistenceDriver()
    expect(Object.keys(driver.get('editor')!)).toEqual(['state', 'original', 'touched'])
    const reopened = new Editor(values(), { persist: true })
    expect(reopened.properties.name.model.value).toBe('draft')
    expect(reopened.isDirty()).toBe(true)
    reopened.properties.name.model.value = 'saved'
    reopened.acceptSavedValues()
    const saved = new Editor(values('saved'), { persist: true })
    expect(saved.isDirty()).toBe(false)
  })

  it.each(['null-state', 'array-state', 'null-original', 'extra-field', 'extra-original', 'extra-touched', 'missing-touched', 'invalid-touched'])(
    'discards malformed %s drafts',
    async (malformation) => {
      const editor = new Editor(values(), { persist: true })
      editor.properties.name.model.value = 'draft'
      await nextTick()
      const driver = new MemoryPersistenceDriver()
      const draft = driver.get<{
        state: Record<string, unknown> | unknown[] | null
        original: Record<string, unknown> | null
        touched: Record<string, unknown>
      }>('editor')!
      if (malformation === 'null-state') draft.state = null
      if (malformation === 'array-state') draft.state = []
      if (malformation === 'null-original') draft.original = null
      if (malformation === 'extra-field') (draft.state as Record<string, unknown>)['unexpected'] = true
      if (malformation === 'extra-original') draft.original!['unexpected'] = true
      if (malformation === 'extra-touched') draft.touched['unexpected'] = false
      if (malformation === 'missing-touched') delete draft.touched['name']
      if (malformation === 'invalid-touched') draft.touched['name'] = 'yes'
      driver.set('editor', draft)
      expect(new Editor(values(), { persist: true }).getStateSnapshot()).toEqual(values())
      expect(driver.get('editor')).toMatchObject({ state: values(), original: values() })
    }
  )

  it('allows a custom policy to restore a structurally valid draft with a different baseline', async () => {
    const editor = new Editor(values(), { persist: true })
    editor.properties.name.model.value = 'draft'
    await nextTick()
    class CustomEditor extends Editor {
      protected override getPersistenceRestorePolicy(): PersistenceRestorePolicy<Values> {
        return { resolve: ({ persisted }) => ({ action: 'restore', reason: 'application_policy', persisted: persisted as PersistedForm<Values> }) }
      }
    }
    expect(new CustomEditor(values('different'), { persist: true }).properties.name.model.value).toBe('draft')
  })
})
