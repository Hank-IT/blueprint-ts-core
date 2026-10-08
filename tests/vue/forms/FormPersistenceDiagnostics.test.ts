import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { BaseForm, MemoryPersistenceDriver, PropertyAwareArray, type PersistenceDebugEvent } from '../../../src/vue/forms'

interface Values {
  rows: PropertyAwareArray<{ label: string }>
}
const values = (labels: string[]): Values => ({ rows: new PropertyAwareArray(labels.map((label) => ({ label }))) })

describe('draft baseline mismatch diagnostics', () => {
  const events: PersistenceDebugEvent<Values>[] = []
  class Editor extends BaseForm<Values, Values> {
    public constructor(initial: Values) {
      super(initial, { persist: true, persistKey: 'diagnostics' })
    }
    protected override getPersistenceDriver() {
      return new MemoryPersistenceDriver()
    }
    protected override logPersistenceDebug(event: PersistenceDebugEvent<Values>) {
      events.push(event)
    }
  }
  beforeEach(() => {
    MemoryPersistenceDriver.clear()
    events.length = 0
  })

  it.each([
    { name: 'changed item', updated: ['first', 'server change'], paths: ['rows.1.label'] },
    { name: 'removed item', updated: ['first'], paths: ['rows'] }
  ])('discards the draft and identifies the $name in the loaded baseline', async ({ updated, paths }) => {
    const editor = new Editor(values(['first', 'second']))
    editor.properties.rows[0]!.label.model.value = 'unsaved'
    await nextTick()
    const reopened = new Editor(values(updated))
    expect(reopened.getStateSnapshot()).toEqual(values(updated))
    expect(reopened.isDirty()).toBe(false)
    expect(events.at(-1)).toMatchObject({ action: 'discard', reason: 'defaults_mismatch', details: { mismatchPaths: paths } })
  })

  it('bounds mismatch diagnostics while still discarding a draft with many changed items', async () => {
    const initial = Array.from({ length: 12 }, (_, i) => `item-${i}`)
    const editor = new Editor(values(initial))
    editor.properties.rows[0]!.label.model.value = 'unsaved'
    await nextTick()
    const updated = initial.map((label) => `${label}-changed`)
    const reopened = new Editor(values(updated))
    expect(reopened.getStateSnapshot()).toEqual(values(updated))
    expect(events.at(-1)).toMatchObject({
      action: 'discard',
      details: { mismatchPaths: Array.from({ length: 10 }, (_, i) => `rows.${i}.label`) }
    })
  })
})
