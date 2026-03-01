import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { State } from '../../../src/vue/state/State'
import type { PersistenceDriver } from '../../../src/persistenceDrivers/types/PersistenceDriver'

class MemoryDriver implements PersistenceDriver {
  public store = new Map<string, unknown>()

  get<T>(key: string): T | null {
    return (this.store.get(key) as T) ?? null
  }

  set<T>(key: string, state: T): void {
    this.store.set(key, state)
  }

  remove(key: string): void {
    this.store.delete(key)
  }
}

let driver: MemoryDriver

class TestState extends State<{ count: number; nested: { value: string }; items: number[] }> {
  protected getPersistenceDriver(): PersistenceDriver {
    return driver
  }
}

describe('State', () => {
  beforeEach(() => {
    driver = new MemoryDriver()
  })

  it('exposes proxy access and deep exports', () => {
    const state = new TestState({ count: 1, nested: { value: 'a' }, items: [1] })

    state.state.count = 2
    expect(state.state.count).toBe(2)

    const exported = state.export()
    exported.nested.value = 'changed'

    expect(state.state.nested.value).toBe('a')
  })

  it('imports values and persists when enabled', () => {
    const state = new TestState(
      { count: 1, nested: { value: 'a' }, items: [1] },
      { persist: true }
    )

    state.import({ count: 5 })

    expect(state.state.count).toBe(5)
    expect(driver.get(state.persistKey)).toEqual({ count: 5, nested: { value: 'a' }, items: [1] })
  })

  it('loads persisted values when keys match', () => {
    driver.set('TestState', { count: 9, nested: { value: 'persisted' }, items: [2] })

    const state = new TestState({ count: 1, nested: { value: 'a' }, items: [1] }, { persist: true })

    expect(state.state.count).toBe(9)
    expect(state.state.nested.value).toBe('persisted')
    expect(state.state.items).toEqual([2])
  })

  it('clears persisted values when keys mismatch', () => {
    driver.set('TestState', { count: 9 })

    const state = new TestState({ count: 1, nested: { value: 'a' }, items: [1] }, { persist: true })

    expect(driver.get(state.persistKey)).toBeNull()
    expect(state.state.count).toBe(1)
  })

  it('subscribes to top-level and nested changes', async () => {
    const state = new TestState({ count: 1, nested: { value: 'a' }, items: [] })

    const countHandler = vi.fn()
    const nestedHandler = vi.fn()

    const stopCount = state.subscribe('count', countHandler)
    const stopNested = state.subscribe('nested.value', nestedHandler)

    state.state.count = 2
    state.state.nested.value = 'b'

    await nextTick()

    expect(countHandler).toHaveBeenCalledTimes(1)
    expect(nestedHandler).toHaveBeenCalledTimes(1)

    stopCount()
    stopNested()

    state.state.count = 3
    await nextTick()
    expect(countHandler).toHaveBeenCalledTimes(1)
  })

  it('supports array path subscriptions and reset handlers', async () => {
    const state = new TestState({ count: 1, nested: { value: 'a' }, items: [] })

    const handler = vi.fn()
    state.subscribe(['count', 'nested.value'], handler, { executeOnReset: true })

    state.reset()

    await nextTick()

    const calls = handler.mock.calls.map((call) => call[0])
    expect(calls).toContain('count')
    expect(calls).toContain('nested.value')
  })

  it('debounces change handlers', async () => {
    vi.useFakeTimers()

    const state = new TestState({ count: 1, nested: { value: 'a' }, items: [] })
    const handler = vi.fn()

    state.subscribe('count', handler, { debounce: 50 })
    state.state.count = 2

    await nextTick()
    expect(handler).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    await nextTick()

    expect(handler).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('destroys watchers and clears internal state', async () => {
    const state = new TestState({ count: 1, nested: { value: 'a' }, items: [] })
    const handler = vi.fn()

    state.subscribe('count', handler)

    state.destroy()

    state.state.count = 2
    await nextTick()

    expect(handler).not.toHaveBeenCalled()
  })
})
