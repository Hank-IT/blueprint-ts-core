import { beforeEach, describe, expect, it } from 'vitest'
import { computed, nextTick } from 'vue'
import { BaseForm, MemoryPersistenceDriver, PropertyAwareArray, PropertyAwareObject, propertyAwareToRaw } from '../../../src/vue/forms'
import { ConfirmedRule, ValidationMode, type ValidationRules } from '../../../src/vue/forms/validation'

interface Row {
  id: string
  label?: string
  position: number
}
interface Values {
  name: string
  optional: string | undefined
  file: File | null
  meta: { label: string; enabled?: boolean }
  plainRows: Row[]
  rows: PropertyAwareArray<Row>
  tags: PropertyAwareArray<string>
  settings: PropertyAwareObject<{ mode: string }>
}
const initialValues = (): Values => ({
  name: 'loaded',
  optional: undefined,
  file: null,
  meta: { label: 'initial', enabled: true },
  plainRows: [
    { id: 'a', label: 'first', position: 1 },
    { id: 'b', label: 'second', position: 2 }
  ],
  rows: new PropertyAwareArray([
    { id: 'a', label: 'first', position: 1 },
    { id: 'b', label: 'second', position: 2 }
  ]),
  tags: new PropertyAwareArray(['alpha', 'beta']),
  settings: new PropertyAwareObject({ mode: 'initial' })
})

class Editor extends BaseForm<Values, Values> {
  public constructor(initial = initialValues(), persist = false) {
    super(initial, { persist, persistKey: 'state-transitions' })
  }
  protected override getPersistenceDriver() {
    return new MemoryPersistenceDriver()
  }
  public addRow(field: 'rows' | 'plainRows', row: Row) {
    this.addToArrayProperty(field, row)
  }
  public removeRow(field: 'rows' | 'plainRows', id: string) {
    this.removeArrayItem(field, (row) => row.id !== id)
    this.resetArrayCounter(field, 'position')
  }
}

describe('form state transitions', () => {
  beforeEach(() => MemoryPersistenceDriver.clear())

  it('returns a detached snapshot while preserving property-aware structures and file identity', () => {
    const file = new File(['payload'], 'upload.txt')
    const initial = { ...initialValues(), file }
    const editor = new Editor(initial)
    const snapshot = editor.getStateSnapshot()
    snapshot.meta.label = 'snapshot edit'
    snapshot.plainRows[0]!.label = 'snapshot edit'
    snapshot.rows[0]!.label = 'snapshot edit'
    snapshot.rows.push({ id: 'c', position: 3 })
    snapshot.tags[0] = 'snapshot edit'
    snapshot.settings['mode'] = 'snapshot edit'
    expect(editor.getStateSnapshot()).toEqual(initial)
    expect(editor.isDirty()).toBe(false)
    expect(snapshot.rows).toBeInstanceOf(PropertyAwareArray)
    expect(snapshot.settings).toBeInstanceOf(PropertyAwareObject)
    expect(snapshot.file).toBe(file)
    editor.properties.rows[0]!.label!.model.value = 'form edit'
    expect(snapshot.rows[0]!.label).toBe('snapshot edit')
  })

  it('extracts raw values from real property wrappers, including cleared optional values and files', () => {
    const file = new File(['payload'], 'upload.txt')
    const editor = new Editor({ ...initialValues(), optional: 'initial', file })
    editor.properties.optional.model.value = undefined
    editor.properties.rows[0]!.label!.model.value = 'edited'
    editor.properties.settings.mode.model.value = 'changed'
    const raw = propertyAwareToRaw({
      name: editor.properties.name,
      optional: editor.properties.optional,
      file: editor.properties.file,
      rows: editor.properties.rows,
      settings: editor.properties.settings
    })
    expect(raw).toEqual({
      name: 'loaded',
      optional: undefined,
      file,
      rows: [
        { id: 'a', label: 'edited', position: 1 },
        { id: 'b', label: 'second', position: 2 }
      ],
      settings: { mode: 'changed' }
    })
    expect(raw.file).toBe(file)
  })

  it('treats partial object and array fills as edits and resets to the constructor baseline', () => {
    const editor = new Editor()
    editor.fillState({
      meta: { label: 'edited' },
      plainRows: [
        { id: 'a', position: 3 },
        { id: 'b', label: 'changed', position: 4 }
      ],
      settings: new PropertyAwareObject({ mode: 'changed' })
    })
    expect(editor.getStateSnapshot().meta).toEqual({ label: 'edited', enabled: true })
    expect(editor.getStateSnapshot().plainRows[0]).toEqual({ id: 'a', label: 'first', position: 3 })
    expect(editor.properties.settings.mode.model.value).toBe('changed')
    for (const field of ['meta', 'plainRows', 'settings'] as const) {
      expect(editor.isDirty(field)).toBe(true)
      expect(editor.isTouched(field)).toBe(true)
    }
    editor.fillState({ plainRows: [] })
    expect(editor.getStateSnapshot().plainRows).toEqual([])
    editor.reset()
    expect(editor.getStateSnapshot()).toEqual(initialValues())
    expect(editor.isDirty()).toBe(false)
  })

  it('accepts normalized nested saved values and isolates the new baseline from later caller mutations', async () => {
    const editor = new Editor()
    const dirty = computed(() => editor.isDirty())
    editor.properties.rows[0]!.label!.model.value = 'unsaved'
    const saved = {
      ...initialValues(),
      rows: new PropertyAwareArray([{ id: 'server', label: 'normalized', position: 1 }]),
      settings: new PropertyAwareObject({ mode: 'saved' })
    }
    editor.acceptSavedValues(saved)
    await nextTick()
    expect(dirty.value).toBe(false)
    expect(editor.isTouched('rows')).toBe(false)
    expect(editor.properties.rows[0]!.label!.model.value).toBe('normalized')
    expect(editor.properties.settings.mode.model.value).toBe('saved')
    saved.rows[0]!.label = 'caller mutation'
    saved.settings['mode'] = 'caller mutation'
    editor.properties.rows[0]!.label!.model.value = 'later edit'
    editor.properties.settings.mode.model.value = 'later edit'
    expect(dirty.value).toBe(true)
    editor.reset()
    expect(editor.properties.rows[0]!.label!.model.value).toBe('normalized')
    expect(editor.properties.settings.mode.model.value).toBe('saved')
    expect(dirty.value).toBe(false)
  })

  it.each(['plainRows', 'rows'] as const)('persists adding, removing and renumbering %s through a real draft round-trip', async (field) => {
    const editor = new Editor(initialValues(), true)
    editor.addRow(field, { id: 'c', label: 'third', position: 3 })
    editor.removeRow(field, 'b')
    await nextTick()
    const reopened = new Editor(initialValues(), true)
    expect(Array.from(reopened.getStateSnapshot()[field])).toEqual([
      { id: 'a', label: 'first', position: 1 },
      { id: 'c', label: 'third', position: 2 }
    ])
    expect(reopened.isDirty(field)).toBe(true)
    expect(reopened.isTouched(field)).toBe(true)
    reopened.reset()
    expect(reopened.getStateSnapshot()).toEqual(initialValues())
    expect(reopened.isDirty()).toBe(false)
  })

  it.each(['plainRows', 'rows'] as const)('syncs a saved %s field without accepting unrelated edits', async (field) => {
    const editor = new Editor(initialValues(), true)
    editor.properties.name.model.value = 'unsaved name'
    const saved = initialValues()
    saved[field][0]!.label = 'saved row'
    editor.syncValue(field, saved[field])
    saved[field][0]!.label = 'caller mutation'
    expect(editor.getStateSnapshot()[field][0]!.label).toBe('saved row')
    expect(editor.isDirty(field)).toBe(false)
    expect(editor.isDirty('name')).toBe(true)
    await nextTick()
    const serverValues = initialValues()
    serverValues[field][0]!.label = 'saved row'
    const reopened = new Editor(serverValues, true)
    expect(reopened.properties.name.model.value).toBe('unsaved name')
    expect(reopened.isDirty(field)).toBe(false)
    reopened.reset()
    expect(reopened.getStateSnapshot()).toEqual(serverValues)
    expect(reopened.isDirty()).toBe(false)
  })

  it('syncs individual scalar and object baselines without retaining mutable input objects', () => {
    const editor = new Editor()
    const savedMeta = { label: 'saved', enabled: false }
    editor.syncValue('meta', savedMeta)
    editor.syncValue('name', 'saved name')
    savedMeta.label = 'caller mutation'
    editor.properties.meta.model.value.label = 'later edit'
    editor.properties.name.model.value = 'later edit'
    editor.reset()
    expect(editor.getStateSnapshot().meta).toEqual({ label: 'saved', enabled: false })
    expect(editor.properties.name.model.value).toBe('saved name')
    expect(editor.isDirty()).toBe(false)
  })

  it('shows primitive array-item errors and clears only the edited item', () => {
    const editor = new Editor()
    editor.fillErrors({ 'tags.0': ['First tag invalid'], 'tags.1': ['Second tag invalid'], name: ['Name invalid'] })
    expect(editor.properties.tags[0]!.value.errors).toEqual(['First tag invalid'])
    expect(editor.properties.tags[1]!.value.errors).toEqual(['Second tag invalid'])
    editor.properties.tags[0]!.value.model.value = 'corrected'
    expect(editor.properties.tags[0]!.value.errors).toEqual([])
    expect(editor.properties.tags[0]!.value.dirty).toBe(true)
    expect(editor.properties.tags[0]!.value.touched).toBe(true)
    expect(editor.getErrors()).toEqual({ 'tags.1': ['Second tag invalid'], name: ['Name invalid'] })
    expect(editor.hasErrors()).toBe(true)
  })

  it('edits duplicate primitive values independently and keeps a field binding usable across successive edits', async () => {
    const values = () => ({ ...initialValues(), tags: new PropertyAwareArray(['same', 'same']) })
    const editor = new Editor(values(), true)
    const second = editor.properties.tags[1]!.value
    second.model.value = 'first edit'
    expect(second.model.value).toBe('first edit')
    second.model.value = 'second edit'
    expect(Array.from(editor.getStateSnapshot().tags)).toEqual(['same', 'second edit'])
    await nextTick()
    const reopened = new Editor(values(), true)
    expect(reopened.properties.tags[1]!.value.model.value).toBe('second edit')
    expect(reopened.isDirty('tags')).toBe(true)
    reopened.reset()
    expect(Array.from(reopened.getStateSnapshot().tags)).toEqual(['same', 'same'])
    editor.fillState({ tags: new PropertyAwareArray(['remaining']) })
    second.model.value = 'removed binding'
    expect(second.model.value).toBeUndefined()
    expect(Array.from(editor.getStateSnapshot().tags)).toEqual(['remaining'])
  })

  it('revalidates both confirmation fields when either value changes', () => {
    interface Credentials {
      password: string
      confirmation: string
    }
    class CredentialsForm extends BaseForm<Credentials, Credentials> {
      public constructor() {
        super({ password: 'initial', confirmation: 'initial' })
      }
      protected override defineRules(): ValidationRules<Credentials> {
        return {
          password: { rules: [new ConfirmedRule('confirmation')], options: { mode: ValidationMode.ON_DEPENDENT_CHANGE } },
          confirmation: { rules: [new ConfirmedRule('password')], options: { mode: ValidationMode.ON_DEPENDENT_CHANGE } }
        }
      }
    }
    const editor = new CredentialsForm()
    expect(editor.getErrors()).toEqual({})
    editor.properties.password.model.value = 'changed'
    expect(editor.properties.password.errors).toEqual(['Must match confirmation'])
    expect(editor.properties.confirmation.errors).toEqual(['Must match password'])
    editor.properties.confirmation.model.value = 'changed'
    expect(editor.getErrors()).toEqual({})
    editor.properties.confirmation.model.value = 'different'
    expect(editor.hasErrors()).toBe(true)
    editor.syncValue('password', 'different')
    expect(editor.getErrors()).toEqual({})
  })

  it('keeps deeply nested array fields editable after adding items and restoring the draft', async () => {
    const group = (title: string) => ({ settings: new PropertyAwareObject({ nested: new PropertyAwareObject({ title }) }) })
    interface Groups {
      groups: PropertyAwareArray<ReturnType<typeof group>>
    }
    class GroupForm extends BaseForm<Groups, Groups> {
      public constructor() {
        super({ groups: new PropertyAwareArray([group('first')]) }, { persist: true, persistKey: 'nested-groups' })
      }
      protected override getPersistenceDriver() {
        return new MemoryPersistenceDriver()
      }
      public add(title: string) {
        this.addToArrayProperty('groups', group(title))
      }
    }
    const editor = new GroupForm()
    editor.add('second')
    editor.fillErrors({ 'groups.0.settings.nested.title': ['Invalid first'], 'groups.1.settings.nested.title': ['Invalid second'] })
    const firstTitle = editor.properties.groups[0]!.settings.nested.title
    expect(firstTitle.errors).toEqual(['Invalid first'])
    firstTitle.model.value = 'edited first'
    expect(firstTitle.dirty).toBe(true)
    expect(firstTitle.touched).toBe(true)
    expect(editor.getErrors()).toEqual({ 'groups.1.settings.nested.title': ['Invalid second'] })
    await nextTick()
    const reopened = new GroupForm()
    expect(reopened.properties.groups[0]!.settings.nested.title.model.value).toBe('edited first')
    expect(reopened.properties.groups[1]!.settings.nested.title.model.value).toBe('second')
    reopened.properties.groups[1]!.settings.nested.title.model.value = 'edited second'
    expect(reopened.isDirty('groups')).toBe(true)
    reopened.reset()
    expect(reopened.getStateSnapshot()).toEqual({ groups: new PropertyAwareArray([group('first')]) })
    expect(reopened.isDirty()).toBe(false)
  })

  it('persists a touched field even if its value was not changed', () => {
    const editor = new Editor(initialValues(), true)
    editor.touch('name')
    const reopened = new Editor(initialValues(), true)
    expect(reopened.isTouched('name')).toBe(true)
    expect(reopened.isDirty()).toBe(false)
    reopened.reset()
    expect(reopened.isTouched('name')).toBe(false)
  })
})
