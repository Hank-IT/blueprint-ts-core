import { describe, expect, it } from 'vitest'
import { DeferredPromise } from '../../../src/support/DeferredPromise'

describe('DeferredPromise', () => {
  it('resolves and updates state', async () => {
    const deferred = new DeferredPromise<string>()

    expect(deferred.state).toBe('pending')

    const resultPromise = deferred.then((value) => `value:${value}`)
    deferred.resolve('ok')

    await expect(resultPromise).resolves.toBe('value:ok')
    expect(deferred.state).toBe('fulfilled')
  })

  it('rejects and updates state', async () => {
    const deferred = new DeferredPromise<string>()

    const resultPromise = deferred.catch((error) => `error:${String(error)}`)
    deferred.reject('boom')

    await expect(resultPromise).resolves.toBe('error:boom')
    expect(deferred.state).toBe('rejected')
  })

  it('supports finally', async () => {
    const deferred = new DeferredPromise<string>()
    let ran = false

    const promise = deferred.finally(() => {
      ran = true
    })

    deferred.resolve('ok')
    await promise

    expect(ran).toBe(true)
  })
})
