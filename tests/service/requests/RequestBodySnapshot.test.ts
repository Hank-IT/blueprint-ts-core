import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BaseRequest,
  createRequestScope,
  RequestEvents,
  BinaryBodyFactory,
  FetchDriver,
  FormDataFactory,
  JsonBodyFactory,
  JsonResponse,
  RequestMethodEnum,
  XMLHttpRequestDriver,
  type BinaryBodyContent,
  type BodyFactoryContract,
  type BodyContract
} from '../../../src/requests'

class Upload<T> extends BaseRequest<boolean, object, object, JsonResponse<object>, T> {
  public constructor(private readonly factory: BodyFactoryContract<T>) {
    super()
  }
  public method(): RequestMethodEnum {
    return RequestMethodEnum.PUT
  }
  public url(): string {
    return '/upload'
  }
  public getResponse(): JsonResponse<object> {
    return new JsonResponse<object>()
  }
  public override getRequestBodyFactory(): BodyFactoryContract<T> {
    return this.factory
  }
}

const readBlob = async (blob: Blob): Promise<number[]> => {
  if (typeof blob.arrayBuffer === 'function') return Array.from(new Uint8Array(await blob.arrayBuffer()))
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(Array.from(new Uint8Array(reader.result as ArrayBuffer)))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

describe.each(['Fetch', 'XHR'] as const)('request-body snapshots through %s', (transport) => {
  let scope: ReturnType<typeof createRequestScope>
  const sent = vi.fn<(body: unknown) => void>()
  beforeEach(() => {
    scope = createRequestScope()
    BaseRequest.getDefaultClient().setBaseUrl('https://example.test')
    sent.mockClear()
    if (transport === 'Fetch') {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async (_url, options) => {
          sent(options?.body)
          return new Response(null, { status: 204 })
        })
      )
      BaseRequest.getDefaultClient().setDriver(new FetchDriver())
    } else {
      class Xhr {
        public status = 204
        public statusText = 'No Content'
        public onload: (() => void) | null = null
        public onabort: (() => void) | null = null
        public upload = {}
        public open(): void {}
        public setRequestHeader(): void {}
        public getAllResponseHeaders(): string {
          return ''
        }
        public send(body: unknown): void {
          sent(body)
          this.onload?.()
        }
        public abort(): void {
          this.onabort?.()
        }
      }
      vi.stubGlobal('XMLHttpRequest', Xhr)
      BaseRequest.getDefaultClient().setDriver(new XMLHttpRequestDriver())
    }
  })
  afterEach(() => {
    scope.dispose()
    vi.unstubAllGlobals()
  })

  it.each(['Blob', 'File'] as const)('preserves a top-level %s and its upload bytes', async (kind) => {
    const bytes = new Uint8Array([0, 128, 255, 65])
    const body =
      kind === 'Blob' ? new Blob([bytes], { type: 'application/octet-stream' }) : new File([bytes], 'part.bin', { type: 'application/octet-stream' })
    await new Upload(new BinaryBodyFactory<Blob>()).setBody(body).send({ resolveBody: false })
    expect(sent).toHaveBeenCalledExactlyOnceWith(body)
    expect(sent.mock.calls[0]![0]).toBe(body)
    expect(await readBlob(sent.mock.calls[0]![0] as Blob)).toEqual([0, 128, 255, 65])
  })

  it.each(['ArrayBuffer', 'Uint8Array', 'DataView', 'Buffer'] as const)('isolates a mutable %s before asynchronous preparation', async (kind) => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const body: BinaryBodyContent =
      kind === 'ArrayBuffer'
        ? bytes.buffer
        : kind === 'Uint8Array'
          ? bytes
          : kind === 'Buffer'
            ? Buffer.from(bytes.buffer)
            : new DataView(bytes.buffer, 1, 2)
    const request = new Upload(new BinaryBodyFactory<BinaryBodyContent>()).setBody(body)
    request.on(RequestEvents.BEFORE_SERIALIZE, async () => {
      bytes.fill(9)
    })
    await request.send({ resolveBody: false })
    const actual = sent.mock.calls[0]![0] as ArrayBuffer | ArrayBufferView
    expect(actual).not.toBe(body)
    const actualBytes = ArrayBuffer.isView(actual) ? new Uint8Array(actual.buffer, actual.byteOffset, actual.byteLength) : new Uint8Array(actual)
    expect(Array.from(actualBytes)).toEqual(kind === 'DataView' ? [2, 3] : [1, 2, 3, 4])
  })

  it('serializes URLSearchParams through a custom factory before later mutations', async () => {
    const body = new URLSearchParams('name=Ada+Lovelace&tag=first&tag=second')
    const factory: BodyFactoryContract<URLSearchParams> = {
      make: (data) => ({ getHeaders: () => ({ 'Content-Type': 'application/x-www-form-urlencoded' }), getContent: () => data.toString() })
    }
    const request = new Upload(factory).setBody(body)
    request.on(RequestEvents.BEFORE_SERIALIZE, async () => {
      body.set('name', 'Later edit')
      body.delete('tag')
    })
    await request.send({ resolveBody: false })
    expect(sent).toHaveBeenCalledExactlyOnceWith('name=Ada+Lovelace&tag=first&tag=second')
  })

  it('serializes a URL with its native methods while isolating later mutations', async () => {
    const body = new URL('https://example.test/original')
    const request = new Upload(new JsonBodyFactory<URL>()).setBody(body)
    request.on(RequestEvents.BEFORE_SERIALIZE, async () => {
      body.pathname = '/later'
    })
    await request.send({ resolveBody: false })
    expect(sent).toHaveBeenCalledExactlyOnceWith('"https://example.test/original"')
  })

  it.each(['root', 'nested'] as const)('serializes a %s class instance with private fields and toJSON', async (position) => {
    class Contact {
      #name = 'Ada'
      public toJSON() {
        return { name: this.#name }
      }
    }
    const contact = new Contact()
    const body = position === 'root' ? contact : { contact }
    await new Upload(new JsonBodyFactory<typeof body>()).setBody(body).send({ resolveBody: false })
    expect(sent).toHaveBeenCalledExactlyOnceWith(position === 'root' ? '{"name":"Ada"}' : '{"contact":{"name":"Ada"}}')
  })

  it('lets a custom factory consume a function body', async () => {
    const factory: BodyFactoryContract<() => string> = {
      make: (data) => ({ getHeaders: () => ({ 'Content-Type': 'text/plain' }), getContent: () => data() })
    }
    await new Upload(factory).setBody(() => 'custom payload').send({ resolveBody: false })
    expect(sent).toHaveBeenCalledExactlyOnceWith('custom payload')
  })

  it('preserves recursive references and custom identities inside a copied data graph', async () => {
    class Contact {
      #name = 'Ada'
      public getName() {
        return this.#name
      }
    }
    const contact = new Contact()
    const entry = { label: 'original', contact }
    const url = new URL('https://example.test/original')
    const body = { entry, entries: new Map([['first', entry]]), selected: new Set([entry]), url, sameUrl: url, self: undefined as unknown }
    body.self = body
    const factory: BodyFactoryContract<typeof body> = {
      make: (data) => {
        expect(data).not.toBe(body)
        expect(data.self).toBe(data)
        expect(data.entries.get('first')).toBe(data.entry)
        expect([...data.selected][0]).toBe(data.entry)
        expect(data.entry.contact).toBe(contact)
        expect(data.sameUrl).toBe(data.url)
        return {
          getHeaders: () => ({ 'Content-Type': 'application/json' }),
          getContent: () => JSON.stringify({ label: data.entry.label, name: data.entry.contact.getName(), url: data.url.href })
        }
      }
    }
    const request = new Upload(factory).setBody(body)
    request.on(RequestEvents.BEFORE_SERIALIZE, async () => {
      body.entry.label = 'later'
      body.url.pathname = '/later'
    })
    await request.send({ resolveBody: false })
    expect(sent).toHaveBeenCalledExactlyOnceWith('{"label":"original","name":"Ada","url":"https://example.test/original"}')
  })

  it('preserves a file nested in a multipart payload', async () => {
    const file = new File(['binary'], 'part.txt', { type: 'text/plain' })
    const body = { label: 'original', file }
    const request = new Upload(new FormDataFactory<typeof body>()).setBody(body)
    request.on(RequestEvents.BEFORE_SERIALIZE, async () => {
      body.label = 'changed after send'
    })
    await request.send({ resolveBody: false })
    const actual = sent.mock.calls[0]![0] as FormData
    expect(actual).toBeInstanceOf(FormData)
    expect(actual.get('label')).toBe('original')
    const uploaded = actual.get('file') as File
    expect(uploaded.name).toBe('part.txt')
    expect(uploaded.type).toBe('text/plain')
    expect(await readBlob(uploaded)).toEqual([98, 105, 110, 97, 114, 121])
  })

  it('copies top-level FormData entries before later mutations', async () => {
    const body = new FormData()
    body.append('label', 'first')
    body.append('label', 'second')
    body.append('file', new File(['binary'], 'part.txt', { type: 'text/plain' }))
    const factory: BodyFactoryContract<FormData> = {
      make: (data): BodyContract => ({ getHeaders: () => ({}), getContent: () => data })
    }
    const request = new Upload(factory).setBody(body)
    request.on(RequestEvents.BEFORE_SERIALIZE, async () => {
      body.set('label', 'later')
      body.delete('file')
    })
    await request.send({ resolveBody: false })
    const actual = sent.mock.calls[0]![0] as FormData
    expect(actual).toBeInstanceOf(FormData)
    expect(actual).not.toBe(body)
    expect(actual.getAll('label')).toEqual(['first', 'second'])
    const uploaded = actual.get('file') as File
    expect(uploaded.name).toBe('part.txt')
    expect(await readBlob(uploaded)).toEqual([98, 105, 110, 97, 114, 121])
  })
})
