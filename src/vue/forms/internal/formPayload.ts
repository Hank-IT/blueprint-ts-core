import { camelCase, upperFirst } from 'lodash-es'
import { PropertyAwareArray } from '../PropertyAwareArray'
import { isRecord, isPropertyAwareObject } from './formValues'
import type { FormKey, RequestKey } from './types'

interface PayloadAccess {
  ignore: readonly string[]
  append: readonly string[]
  formName: string
  getValueGetter(name: string): ((value: unknown) => unknown) | undefined
  getNoArgGetter(name: string): (() => unknown) | undefined
}

function transformValue(value: unknown, access: PayloadAccess, parentKey?: string): unknown {
  if (value instanceof Date) {
    return value
  }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return value
  }
  if (value instanceof PropertyAwareArray) {
    return [...value].map((item) => transformValue(item, access, parentKey))
  }
  if (isPropertyAwareObject(value)) {
    const result: Record<string, unknown> = {}
    const valueRecord = value as Record<string, unknown>
    for (const prop in valueRecord) {
      const transformed = transformValue(valueRecord[prop], access, parentKey)
      if (transformed !== undefined) {
        result[prop] = transformed
      }
    }
    return result
  }
  if (Array.isArray(value)) {
    return value.map((item) => transformValue(item, access, parentKey))
  } else if (isRecord(value)) {
    const result: Record<string, unknown> = {}
    for (const prop in value) {
      if (parentKey) {
        const compositeMethod = 'get' + upperFirst(parentKey) + upperFirst(camelCase(prop))
        const getter = access.getValueGetter(compositeMethod)
        if (getter) {
          const transformed = getter(value[prop])
          if (transformed !== undefined) {
            result[prop] = transformed
          }
          continue
        }
      }
      const transformed = transformValue(value[prop], access, parentKey)
      if (transformed !== undefined) {
        result[prop] = transformed
      }
    }
    return result
  }
  return value
}

export function buildFormPayload<RequestBody extends object, FormBody extends object>(state: FormBody, access: PayloadAccess): RequestBody {
  const payload = {} as RequestBody
  for (const key of Object.keys(state) as Array<FormKey<FormBody> & RequestKey<RequestBody>>) {
    if (access.ignore.includes(key)) {
      continue
    }

    const value = state[key]

    const getterName = 'get' + upperFirst(camelCase(key))
    const typedKey = key
    const getter = access.getValueGetter(getterName)
    if (getter) {
      const transformed = getter(value)
      if (transformed !== undefined) {
        payload[typedKey] = transformed as RequestBody[typeof typedKey]
      }
    } else {
      const transformed = transformValue(value, access, key)
      if (transformed !== undefined) {
        payload[typedKey] = transformed as RequestBody[typeof typedKey]
      }
    }
  }

  for (const fieldName of access.append) {
    if (Array.isArray(access.ignore) && access.ignore.includes(fieldName)) {
      console.warn(`Appended field '${fieldName}' is also in ignore list in ${access.formName}. It will be skipped.`)
      continue
    }

    const getterName = 'get' + upperFirst(camelCase(fieldName))
    const getter = access.getNoArgGetter(getterName)
    if (getter) {
      const transformed = getter()
      if (transformed !== undefined) {
        payload[fieldName as keyof RequestBody] = transformed as RequestBody[keyof RequestBody]
      }
    } else {
      console.warn(`Getter method '${getterName}' not found for appended field '${fieldName}' in ${access.formName}.`)
    }
  }

  return payload
}
