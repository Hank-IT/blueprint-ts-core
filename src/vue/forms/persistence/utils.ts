import { isEqual } from 'lodash-es'
import { PropertyAwareArray } from '../PropertyAwareArray'
import { PropertyAwareObject, PROPERTY_AWARE_OBJECT_MARKER } from '../PropertyAwareObject'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isPropertyAwareObject(value: unknown): value is PropertyAwareObject<object> {
  return value instanceof PropertyAwareObject
}

function isSerializedPropertyAwareObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && value[PROPERTY_AWARE_OBJECT_MARKER] === true
}

function normalizePropertyAwareEqualityValue<T>(value: T): T {
  if (value instanceof PropertyAwareArray) {
    return Array.from(value, (item) => normalizePropertyAwareEqualityValue(item)) as T
  }

  if (isPropertyAwareObject(value) || isSerializedPropertyAwareObject(value)) {
    const normalized: Record<string, unknown> = {}

    for (const [key, child] of Object.entries(value)) {
      if (key === PROPERTY_AWARE_OBJECT_MARKER) {
        continue
      }

      normalized[key] = normalizePropertyAwareEqualityValue(child)
    }

    return normalized as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizePropertyAwareEqualityValue(item)) as T
  }

  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {}

    for (const [key, child] of Object.entries(value)) {
      normalized[key] = normalizePropertyAwareEqualityValue(child)
    }

    return normalized as T
  }

  return value
}

export function propertyAwareDeepEqual<T>(a: T, b: T): boolean {
  return isEqual(normalizePropertyAwareEqualityValue(a), normalizePropertyAwareEqualityValue(b))
}

export function collectPropertyAwareMismatchPaths(a: unknown, b: unknown, path = '', maxPaths = 10): string[] {
  const mismatches: string[] = []

  const visit = (left: unknown, right: unknown, currentPath: string): void => {
    if (mismatches.length >= maxPaths) {
      return
    }

    const normalizedLeft = normalizePropertyAwareEqualityValue(left)
    const normalizedRight = normalizePropertyAwareEqualityValue(right)

    if (isEqual(normalizedLeft, normalizedRight)) {
      return
    }

    if (Array.isArray(normalizedLeft) && Array.isArray(normalizedRight)) {
      if (normalizedLeft.length !== normalizedRight.length) {
        mismatches.push(currentPath || '(root)')
        return
      }

      normalizedLeft.forEach((item, index) => {
        visit(item, normalizedRight[index], currentPath ? `${currentPath}.${index}` : String(index))
      })

      return
    }

    if (isRecord(normalizedLeft) && isRecord(normalizedRight)) {
      const keys = new Set([...Object.keys(normalizedLeft), ...Object.keys(normalizedRight)])

      for (const key of keys) {
        visit(normalizedLeft[key], normalizedRight[key], currentPath ? `${currentPath}.${key}` : key)

        if (mismatches.length >= maxPaths) {
          return
        }
      }

      return
    }

    mismatches.push(currentPath || '(root)')
  }

  visit(a, b, path)

  return mismatches
}
