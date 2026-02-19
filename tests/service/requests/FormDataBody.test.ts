import { describe, it, expect } from 'vitest'
import { FormDataBody } from '../../../src/service/requests/bodies/FormDataBody'

describe('FormDataBody', () => {
  it('appends strings and files', () => {
    const file = new File(['abc'], 'credentials.kdbx', { type: 'application/octet-stream' })

    const body = new FormDataBody({
      name: 'aerg',
      type: 'kdbx',
      password: 'aerg',
      file,
    })

    const fd = body.getContent()

    expect(fd.get('name')).toBe('aerg')
    expect(fd.get('type')).toBe('kdbx')
    expect(fd.get('password')).toBe('aerg')
    expect(fd.get('file')).toBe(file)
  })

  it('encodes null as empty string (key present)', () => {
    const body = new FormDataBody({
      name: 'aerg',
      file: null,
    })

    const fd = body.getContent()
    expect(fd.get('name')).toBe('aerg')
    expect(fd.get('file')).toBe('')
  })

  it('rejects undefined values (should not be silently dropped)', () => {
    expect(
      () =>
        new FormDataBody({
          missing: undefined,
        } as any),
    ).toThrow()
  })

  it('stringifies number/boolean values', () => {
    const body = new FormDataBody({
      count: 3,
      enabled: false,
    })

    const fd = body.getContent()
    expect(fd.get('count')).toBe('3')
    expect(fd.get('enabled')).toBe('false')
  })

  it('supports arrays via bracket notation', () => {
    const body = new FormDataBody({
      tags: ['a', 'b'],
    })

    const fd = body.getContent()
    expect(fd.get('tags[0]')).toBe('a')
    expect(fd.get('tags[1]')).toBe('b')
  })
})
