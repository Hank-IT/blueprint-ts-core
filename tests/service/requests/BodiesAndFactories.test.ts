import { describe, expect, it } from 'vitest'
import { BinaryBody } from '../../../src/requests/bodies/BinaryBody'
import { JsonBody } from '../../../src/requests/bodies/JsonBody'
import { BinaryBodyFactory } from '../../../src/requests/factories/BinaryBodyFactory'
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

  it('BinaryBody returns explicit content type and binary content', () => {
    const body = new BinaryBody(new Uint8Array([1, 2, 3]), 'application/octet-stream')

    expect(body.getHeaders()).toEqual({ 'Content-Type': 'application/octet-stream' })
    expect(body.getContent()).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('BinaryBody uses Blob mime type when no explicit content type is given', () => {
    const blob = new Blob(['hello'], { type: 'application/custom-binary' })
    const body = new BinaryBody(blob)

    expect(body.getHeaders()).toEqual({ 'Content-Type': 'application/custom-binary' })
    expect(body.getContent()).toBe(blob)
  })

  it('BinaryBodyFactory returns BinaryBody', () => {
    const factory = new BinaryBodyFactory<Uint8Array>('application/octet-stream')
    const body = factory.make(new Uint8Array([4, 5, 6]))

    expect(body).toBeInstanceOf(BinaryBody)
  })

  it('FormDataFactory returns FormDataBody', () => {
    const factory = new FormDataFactory<{ name: string }>()
    const body = factory.make({ name: 'alice' })

    expect(body).toBeInstanceOf(FormDataBody)
  })
})
