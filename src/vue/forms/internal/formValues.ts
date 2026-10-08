import { cloneDeepWith, isEqual } from 'lodash-es'
import { PropertyAwareArray } from '../PropertyAwareArray'
import { PropertyAwareObject, PROPERTY_AWARE_OBJECT_MARKER } from '../PropertyAwareObject'
import type { ArrayItem, PropertyAwareToRaw } from './types'

// Blob/File values are immutable and must retain their identity when cloning a form value.
export const cloneFormValue = <T>(value: T): T =>
  cloneDeepWith(value, (child) => (typeof Blob !== 'undefined' && child instanceof Blob ? child : undefined))

interface DirtyObject {
  [key: string]: DirtyState
}
type DirtyState = boolean | DirtyObject

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isPropertyAwareObject(value: unknown): value is PropertyAwareObject<object> {
  return value instanceof PropertyAwareObject
}

function isSerializedPropertyAwareObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && value[PROPERTY_AWARE_OBJECT_MARKER] === true
}

function restoreSerializedPropertyAwareValue<T>(value: T): T {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return value
  if (Array.isArray(value)) {
    return value.map((item) => restoreSerializedPropertyAwareValue(item)) as T
  }

  if (isSerializedPropertyAwareObject(value)) {
    const restored: Record<string, unknown> = {}

    for (const [key, child] of Object.entries(value)) {
      if (key === PROPERTY_AWARE_OBJECT_MARKER) {
        continue
      }

      restored[key] = restoreSerializedPropertyAwareValue(child)
    }

    return new PropertyAwareObject(restored) as T
  }

  if (isRecord(value)) {
    const restored: Record<string, unknown> = {}

    for (const [key, child] of Object.entries(value)) {
      restored[key] = restoreSerializedPropertyAwareValue(child)
    }

    return restored as T
  }

  return value
}

export function propertyAwareToRaw<T>(propertyAwareObject: T): PropertyAwareToRaw<T> {
  if (typeof Blob !== 'undefined' && propertyAwareObject instanceof Blob) return propertyAwareObject as PropertyAwareToRaw<T>
  if (Array.isArray(propertyAwareObject)) {
    return propertyAwareObject.map((item) => propertyAwareToRaw(item)) as PropertyAwareToRaw<T>
  }

  if (!isRecord(propertyAwareObject)) {
    return propertyAwareObject as PropertyAwareToRaw<T>
  }

  const result: Record<string, unknown> = {}
  const record = propertyAwareObject

  for (const key in record) {
    if (!Object.prototype.hasOwnProperty.call(record, key) || key.startsWith('_')) {
      continue
    }

    const value = record[key]
    const model = isRecord(value) ? value['model'] : undefined

    if (isRecord(model) && 'value' in model) {
      result[key] = model['value']
      continue
    }

    if (value && typeof value === 'object') {
      result[key] = propertyAwareToRaw(value)
      continue
    }

    result[key] = value
  }

  return result as PropertyAwareToRaw<T>
}

/** Helper: shallow-merge source object into target. */
export function shallowMerge<T extends object, U extends object>(target: T, source: U): T & U {
  Object.assign(target, source)
  return target as T & U
}

/** Helper: if both values are arrays, update each element if possible, otherwise replace. */
export function deepMergeArrays<T>(target: T[], source: T[]): T[] {
  if (target.length !== source.length) {
    return source
  }
  return target.map((t, i) => {
    const s = source[i]
    if (s === undefined) {
      return t
    }
    if (t && typeof t === 'object' && s && typeof s === 'object') {
      return shallowMerge({ ...t }, s)
    }
    return s
  })
}

export function restorePropertyAwareStructure<T>(defaults: T, value: unknown): T {
  if (value === undefined) return value as T
  if (defaults instanceof PropertyAwareArray) {
    const restored = value instanceof PropertyAwareArray ? value : new PropertyAwareArray(Array.isArray(value) ? Array.from(value) : [])
    const defaultItemTemplate = defaults[0]

    for (let index = 0; index < restored.length; index++) {
      if (index < defaults.length) {
        restored[index] = restorePropertyAwareStructure(defaults[index], restored[index])
      } else if (defaultItemTemplate !== undefined) {
        restored[index] = restorePropertyAwareStructure(defaultItemTemplate, restored[index])
      } else {
        restored[index] = restoreSerializedPropertyAwareValue(restored[index])
      }
    }

    return restored as T
  }

  if (defaults instanceof PropertyAwareObject) {
    const restored = value instanceof PropertyAwareObject ? value : new PropertyAwareObject(isRecord(value) ? value : {})
    const restoredRecord = restored as Record<string, unknown>
    delete restoredRecord[PROPERTY_AWARE_OBJECT_MARKER]
    const defaultRecord = defaults as Record<string, unknown>

    for (const key of Object.keys(defaults)) {
      restoredRecord[key] = restorePropertyAwareStructure(defaultRecord[key], restoredRecord[key])
    }

    return restored as T
  }

  if (isRecord(defaults) && isRecord(value)) {
    for (const key of Object.keys(defaults)) {
      value[key] = restorePropertyAwareStructure(defaults[key], value[key])
    }

    return value as T
  }

  return restoreSerializedPropertyAwareValue(value as T)
}

export function computeDirtyState<T>(current: T, original: T): DirtyState {
  if (Array.isArray(current) && Array.isArray(original)) {
    return current.length !== original.length || !isEqual(current, original)
  } else if (typeof Blob !== 'undefined' && (current instanceof Blob || original instanceof Blob)) {
    return current !== original
  } else if (current && typeof current === 'object' && original && typeof original === 'object') {
    const dirty: DirtyObject = {}
    for (const key in current) {
      if (Object.prototype.hasOwnProperty.call(current, key)) {
        dirty[key] = computeDirtyState(current[key], original[key])
      }
    }
    return dirty
  }
  return !isEqual(current, original)
}

export function getNestedDirtyValue(value: DirtyState | undefined, path: string[]): boolean {
  if (path.length === 0) {
    if (typeof value === 'boolean') {
      return value
    }

    if (isRecord(value)) {
      return Object.values(value).some((item) => getNestedDirtyValue(item as DirtyState, []))
    }

    return false
  }

  if (typeof value === 'boolean') return value
  if (!isRecord(value)) {
    return false
  }

  const [segment, ...rest] = path
  if (segment === undefined) {
    return false
  }

  return getNestedDirtyValue(value[segment] as DirtyState | undefined, rest)
}

export function replacePropertyAwareArray<FormBody extends object, K extends keyof FormBody>(
  state: FormBody,
  key: K,
  values: Array<ArrayItem<FormBody[K]>>
): void {
  const current = state[key]
  if (current instanceof PropertyAwareArray) {
    current.length = 0
    values.forEach((item) => current.push(item))
    return
  }

  state[key] = new PropertyAwareArray(values) as FormBody[K]
}
