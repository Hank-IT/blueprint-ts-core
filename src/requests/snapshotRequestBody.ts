import { cloneDeepWith, isPlainObject } from 'lodash-es'

const copiedPrototypes = new Set([
  Array.prototype,
  Date.prototype,
  RegExp.prototype,
  Map.prototype,
  Set.prototype,
  ArrayBuffer.prototype,
  DataView.prototype,
  Int8Array.prototype,
  Uint8Array.prototype,
  Uint8ClampedArray.prototype,
  Int16Array.prototype,
  Uint16Array.prototype,
  Int32Array.prototype,
  Uint32Array.prototype,
  Float32Array.prototype,
  Float64Array.prototype,
  BigInt64Array.prototype,
  BigUint64Array.prototype
])

export function snapshotRequestBody<T>(value: T): T {
  const copies = new WeakMap<object, unknown>()
  const bufferFactory = (globalThis as { Buffer?: { isBuffer(value: unknown): value is Uint8Array; from(value: Uint8Array): Uint8Array } }).Buffer
  return cloneDeepWith(value, (child) => {
    if (typeof child === 'function') return child
    if (child === null || typeof child !== 'object') return undefined
    if (typeof Blob !== 'undefined' && child instanceof Blob) return child
    if (copies.has(child)) return copies.get(child)
    const prototype = Object.getPrototypeOf(child)
    let copy: unknown
    if (typeof URL !== 'undefined' && prototype === URL.prototype) copy = new URL(child.href)
    else if (typeof URLSearchParams !== 'undefined' && prototype === URLSearchParams.prototype) copy = new URLSearchParams(child)
    else if (typeof FormData !== 'undefined' && prototype === FormData.prototype) {
      const data = new FormData()
      child.forEach((entry: FormDataEntryValue, name: string) => data.append(name, entry))
      copy = data
    } else if (bufferFactory?.isBuffer(child)) copy = bufferFactory.from(child)
    if (copy !== undefined) {
      copies.set(child, copy)
      return copy
    }
    // Custom instances can have private fields or native internal slots that cloning cannot recreate.
    return isPlainObject(child) || copiedPrototypes.has(prototype) ? undefined : child
  })
}
