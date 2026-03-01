import { describe, expect, it } from 'vitest'
import { JsonBody } from '../../../src/requests/bodies/JsonBody'
import { JsonBodyFactory } from '../../../src/requests/factories/JsonBodyFactory'
import { FormDataFactory } from '../../../src/requests/factories/FormDataFactory'
import { FormDataBody } from '../../../src/requests/bodies/FormDataBody'

describe('Request bodies and factories', () => {
  it('JsonBody returns headers and JSON content', () => {
    const body = new JsonBody({ hello: 'world' })

    expect(body.getHeaders()).toEqual({ 'Content-Type': 'application/json' })
    expect(body.getContent()).toBe('{"hello":"world"}')
  })

  it('JsonBodyFactory returns JsonBody', () => {
    const factory = new JsonBodyFactory<{ foo: string }>()
    const body = factory.make({ foo: 'bar' })

    expect(body).toBeInstanceOf(JsonBody)
  })

  it('FormDataFactory returns FormDataBody', () => {
    const factory = new FormDataFactory<{ name: string }>()
    const body = factory.make({ name: 'alice' })

    expect(body).toBeInstanceOf(FormDataBody)
  })
})
