import { beforeEach, describe, expect, it } from 'vitest'
import { LocalStorageDriver } from '../../../src/persistenceDrivers/LocalStorageDriver'
import { NonPersistentDriver } from '../../../src/persistenceDrivers/NonPersistentDriver'
import { SessionStorageDriver } from '../../../src/persistenceDrivers/SessionStorageDriver'

const clearStorage = () => {
  localStorage.clear()
  sessionStorage.clear()
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
})
