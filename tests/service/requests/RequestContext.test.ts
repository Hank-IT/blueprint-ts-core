import { describe, expect, it } from 'vitest'
import { RequestContext, createRequestContextKey } from '../../../src/requests'

describe('RequestContext', () => {
  it('copies and freezes nested context data without freezing caller-owned values', () => {
    const key = createRequestContextKey<{ filters: Array<{ label: string }>; optional: null; lookup: Record<string, string> }>('search')
    const lookup: Record<string, string> = Object.create(null)
    lookup['locale'] = 'en'
    const value = { filters: [{ label: 'original' }], optional: null, lookup }
    const context = new RequestContext().with(key, value)
    value.filters[0]!.label = 'changed'
    value.filters.push({ label: 'new' })
    lookup['locale'] = 'de'
    const snapshot = context.require(key)
    expect(snapshot).toEqual({ filters: [{ label: 'original' }], optional: null, lookup: { locale: 'en' } })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.filters)).toBe(true)
    expect(Object.isFrozen(snapshot.filters[0])).toBe(true)
    expect(Object.isFrozen(snapshot.lookup)).toBe(true)
    expect(Object.isFrozen(value)).toBe(false)
  })

  it('merges per-call values over shared context without changing either source', () => {
    const locale = createRequestContextKey<string>('locale')
    const owner = createRequestContextKey<{ id: string }>('owner')
    const trace = createRequestContextKey<string>('trace')
    const shared = new RequestContext().with(locale, 'en').with(owner, { id: 'owner-a' })
    const perCall = new RequestContext().with(locale, 'de').with(trace, 'trace-a')
    const merged = shared.merge(perCall)
    expect(merged.require(locale)).toBe('de')
    expect(merged.require(owner)).toEqual({ id: 'owner-a' })
    expect(merged.require(trace)).toBe('trace-a')
    expect(shared.require(locale)).toBe('en')
    expect(shared.get(trace)).toBeUndefined()
    expect(perCall.get(owner)).toBeUndefined()
    expect(Object.isFrozen(merged.require(owner))).toBe(true)
    expect(merged.with(locale, 'fr').require(locale)).toBe('fr')
    expect(merged.require(locale)).toBe('de')
  })

  it('keeps independently declared keys distinct even when their descriptions match', () => {
    const first = createRequestContextKey<string>('tenant')
    const second = createRequestContextKey<string>('tenant')
    const context = new RequestContext().with(first, 'one')
    expect(context.get(second)).toBeUndefined()
    expect(() => context.require(second)).toThrow('Missing request context: tenant')
    const extended = context.with(second, 'two')
    expect(extended.require(first)).toBe('one')
    expect(extended.require(second)).toBe('two')
  })

  it.each([
    ['function', () => undefined],
    ['date', new Date('2026-01-01')],
    ['map', new Map([['key', 'value']])]
  ])('rejects a nested %s instead of silently losing its behavior', (_name, value) => {
    const key = createRequestContextKey<unknown>('application')
    expect(() => new RequestContext().with(key, { nested: [value] })).toThrow(TypeError)
  })
})
