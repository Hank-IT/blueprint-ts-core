import { describe, expect, it } from 'vitest'
import { VueRequestLoader } from '../../../src/vue/requests/loaders/VueRequestLoader'
import { VueRequestBatchLoader } from '../../../src/vue/requests/loaders/VueRequestBatchLoader'
import { VueRequestLoaderFactory } from '../../../src/vue/requests/factories/VueRequestLoaderFactory'


describe('Vue request loaders', () => {
  it('VueRequestLoader tracks loading state', () => {
    const loader = new VueRequestLoader()

    expect(loader.isLoading().value).toBe(false)

    loader.setLoading(true)
    expect(loader.isLoading().value).toBe(true)

    loader.setLoading(false)
    expect(loader.isLoading().value).toBe(false)
  })

  it('VueRequestBatchLoader tracks batch state', () => {
    const loader = new VueRequestBatchLoader(2)

    expect(loader.isLoading().value).toBe(true)

    loader.setLoading(true)
    expect(loader.isLoading().value).toBe(true)

    loader.setLoading(false)
    expect(loader.isLoading().value).toBe(true)

    loader.setLoading(false)
    expect(loader.isLoading().value).toBe(false)

    loader.startBatch(1)
    expect(loader.isLoading().value).toBe(true)

    loader.abortBatch()
    expect(loader.isLoading().value).toBe(false)
  })

  it('VueRequestLoaderFactory creates a loader', () => {
    const factory = new VueRequestLoaderFactory()

    const loader = factory.make()

    expect(loader.isLoading().value).toBe(false)
  })
})
