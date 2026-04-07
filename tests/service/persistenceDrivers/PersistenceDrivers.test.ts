import { beforeEach, describe, expect, it } from 'vitest'
import { LocalStorageDriver } from '../../../src/persistenceDrivers/LocalStorageDriver'
import { MemoryPersistenceDriver } from '../../../src/persistenceDrivers/MemoryPersistenceDriver'
import { NonPersistentDriver } from '../../../src/persistenceDrivers/NonPersistentDriver'
import { SessionStorageDriver } from '../../../src/persistenceDrivers/SessionStorageDriver'

const clearStorage = () => {
  localStorage.clear()
  sessionStorage.clear()
  MemoryPersistenceDriver.clear()
}

describe('Persistence drivers', () => {
  beforeEach(() => {
    clearStorage()
  })

  it('NonPersistentDriver does not persist', () => {
    const driver = new NonPersistentDriver()

    expect(driver.get('any')).toBeNull()
    expect(() => driver.set('key', { value: 1 })).not.toThrow()
    expect(() => driver.remove('key')).not.toThrow()
  })

  it('LocalStorageDriver stores and retrieves values with suffix', () => {
    const driver = new LocalStorageDriver('abc')

    driver.set('user', { id: 1 })

    expect(localStorage.getItem('state_user_abc')).toBe('{"id":1}')
    expect(driver.get('user')).toEqual({ id: 1 })

    driver.remove('user')
    expect(localStorage.getItem('state_user_abc')).toBeNull()
  })

  it('LocalStorageDriver stores and retrieves values without suffix', () => {
    const driver = new LocalStorageDriver()

    driver.set('prefs', { dark: true })

    expect(localStorage.getItem('state_prefs')).toBe('{"dark":true}')
    expect(driver.get('prefs')).toEqual({ dark: true })
  })

  it('SessionStorageDriver stores and retrieves values with suffix', () => {
    const driver = new SessionStorageDriver('v1')

    driver.set('token', { value: 'abc' })

    expect(sessionStorage.getItem('state_token_v1')).toBe('{"value":"abc"}')
    expect(driver.get('token')).toEqual({ value: 'abc' })

    driver.remove('token')
    expect(sessionStorage.getItem('state_token_v1')).toBeNull()
  })

  it('MemoryPersistenceDriver stores and retrieves values without suffix', () => {
    const driver = new MemoryPersistenceDriver()

    driver.set('prefs', { dark: true })

    expect(driver.get('prefs')).toEqual({ dark: true })
  })

  it('MemoryPersistenceDriver stores and retrieves values with suffix across instances', () => {
    const first = new MemoryPersistenceDriver('tests')
    const second = new MemoryPersistenceDriver('tests')

    first.set('draft', { value: 'abc' })

    expect(second.get('draft')).toEqual({ value: 'abc' })
  })

  it('MemoryPersistenceDriver isolates values by suffix and can remove entries', () => {
    const first = new MemoryPersistenceDriver('a')
    const second = new MemoryPersistenceDriver('b')

    first.set('draft', { value: 1 })
    second.set('draft', { value: 2 })

    expect(first.get('draft')).toEqual({ value: 1 })
    expect(second.get('draft')).toEqual({ value: 2 })

    first.remove('draft')

    expect(first.get('draft')).toBeNull()
    expect(second.get('draft')).toEqual({ value: 2 })
  })
})
