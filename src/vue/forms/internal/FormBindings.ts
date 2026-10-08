import { computed, type WritableComputedRef } from 'vue'
import { isEqual } from 'lodash-es'
import { PropertyAwareArray } from '../PropertyAwareArray'
import { isRecord, isPropertyAwareObject, computeDirtyState, getNestedDirtyValue, replacePropertyAwareArray } from './formValues'
import type { ArrayItem, ErrorMessages, FieldProperty, FormKey, FormProperties, PropertyAwareInput } from './types'
import type { FormErrors } from './FormErrors'

interface FieldEdits<FormBody extends object> {
  fieldChanged(field: keyof FormBody): void
  nestedFieldChanged(field: keyof FormBody, path: string[]): void
  isDirty(field: keyof FormBody): boolean
}

/** Builds reactive fields and preserves object-item identity across array reordering. */
export class FormBindings<FormBody extends object> {
  private readonly _model: { [K in keyof FormBody]: WritableComputedRef<FormBody[K]> }
  private readonly arrayWrapperCache = new Map<keyof FormBody, Array<unknown>>()
  private readonly arrayItemWrapperCache = new Map<keyof FormBody, WeakMap<object, Record<string, unknown>>>()

  public constructor(
    private readonly state: FormBody,
    private readonly original: FormBody,
    private readonly touched: Readonly<Record<keyof FormBody, boolean>>,
    private readonly errors: FormErrors,
    private readonly edits: FieldEdits<FormBody>
  ) {
    this._model = {} as { [K in keyof FormBody]: WritableComputedRef<FormBody[K]> }

    for (const key in this.state) {
      const value = this.state[key]
      if (value instanceof PropertyAwareArray) {
        this._model[key as keyof FormBody] = computed({
          get: () => this.state[key],
          set: (newVal: PropertyAwareInput<FormBody[typeof key]>) => {
            const next = Array.isArray(newVal) ? Array.from(newVal) : []
            replacePropertyAwareArray(this.state, key as keyof FormBody, next)
            this.edits.fieldChanged(key as keyof FormBody)
          }
        })
      } else {
        this._model[key as keyof FormBody] = computed({
          get: () => this.state[key],
          set: (value: FormBody[typeof key]) => {
            this.state[key] = value
            this.edits.fieldChanged(key as keyof FormBody)
          }
        })
      }
    }
  }

  private getArrayItemDirty(field: keyof FormBody, index: number, innerKey: string): boolean {
    const current = this.state[field]
    const original = this.original[field]
    if (!Array.isArray(current) || !Array.isArray(original)) return false
    return getNestedDirtyValue(computeDirtyState(current[index], original[index]), innerKey.split('.'))
  }

  private getArrayItemDirtyValue(field: keyof FormBody, index: number): boolean {
    const current = this.state[field]
    const original = this.original[field]
    return Array.isArray(current) && Array.isArray(original) && !isEqual(current[index], original[index])
  }

  private createFieldProperty<T>(
    getValue: () => T,
    setValue: (value: T) => void,
    getErrors: () => ErrorMessages,
    getDirty: () => boolean,
    getTouched: () => boolean
  ): FieldProperty<T> {
    const field = {
      model: computed({
        get: getValue,
        set: setValue
      })
    } as FieldProperty<T>

    Object.defineProperties(field, {
      errors: {
        enumerable: true,
        get: getErrors
      },
      dirty: {
        enumerable: true,
        get: getDirty
      },
      touched: {
        enumerable: true,
        get: getTouched
      }
    })

    return field
  }

  private resolveArrayItemIndex<K extends keyof FormBody>(field: K, item: ArrayItem<FormBody[K]>): number {
    const value = this.state[field]

    if (!(value instanceof PropertyAwareArray)) {
      return -1
    }

    return value.indexOf(item)
  }

  private getArrayItemValueByPath<K extends keyof FormBody>(field: K, index: number, path: string[]): unknown {
    if (index < 0 || index >= (this.state[field] as PropertyAwareArray).length) {
      return undefined
    }

    let current: unknown = (this.state[field] as PropertyAwareArray<ArrayItem<FormBody[K]>>)[index]
    for (const segment of path) {
      if (!isRecord(current)) {
        return undefined
      }

      current = current[segment]
    }

    return current
  }

  private setArrayItemValueByPath<K extends keyof FormBody>(field: K, index: number, path: string[], value: unknown): void {
    if (index < 0 || index >= (this.state[field] as PropertyAwareArray).length) {
      return
    }

    if (path.length === 0) {
      ;(this.state[field] as PropertyAwareArray<ArrayItem<FormBody[K]>>)[index] = value as ArrayItem<FormBody[K]>
      this.edits.nestedFieldChanged(field, [String(index)])
      return
    }

    const currentItem = (this.state[field] as PropertyAwareArray<ArrayItem<FormBody[K]>>)[index]
    if (!isRecord(currentItem)) {
      return
    }

    let current: Record<string, unknown> = currentItem as Record<string, unknown>
    const segments = [...path]
    const last = segments.pop()
    if (last === undefined) {
      return
    }

    for (const segment of segments) {
      const next = current[segment]
      if (!isRecord(next)) {
        return
      }

      current = next
    }

    current[last] = value

    this.edits.nestedFieldChanged(field, [String(index), ...path])
  }

  private createObjectWrapperFromShape(
    shape: object,
    getValueByPath: (path: string[]) => unknown,
    setValueByPath: (path: string[], value: unknown) => void,
    getErrorsByPath: (path: string[]) => ErrorMessages,
    getDirtyByPath: (path: string[]) => boolean,
    getTouched: () => boolean
  ): Record<string, unknown> {
    const wrapper: Record<string, unknown> = {}
    const shapeRecord = shape as Record<string, unknown>

    for (const innerKey of Object.keys(shape)) {
      const child = shapeRecord[innerKey]
      if (isPropertyAwareObject(child)) {
        wrapper[innerKey] = this.createObjectWrapperFromShape(
          child,
          (path) => getValueByPath([innerKey, ...path]),
          (path, value) => setValueByPath([innerKey, ...path], value),
          (path) => getErrorsByPath([innerKey, ...path]),
          (path) => getDirtyByPath([innerKey, ...path]),
          getTouched
        )
        continue
      }

      wrapper[innerKey] = this.createFieldProperty(
        () => getValueByPath([innerKey]) as typeof child,
        (newValue) => setValueByPath([innerKey], newValue),
        () => getErrorsByPath([innerKey]),
        () => getDirtyByPath([innerKey]),
        getTouched
      )
    }

    return wrapper
  }

  private getOrCreateArrayItemWrapper<K extends keyof FormBody>(field: K, item: ArrayItem<FormBody[K]>, itemIndex: number): Record<string, unknown> {
    let fieldCache = this.arrayItemWrapperCache.get(field)
    if (!fieldCache) {
      fieldCache = new WeakMap<object, Record<string, unknown>>()
      this.arrayItemWrapperCache.set(field, fieldCache)
    }

    const existing = isRecord(item) ? fieldCache.get(item) : undefined
    if (existing) {
      return existing
    }

    const wrapper: Record<string, unknown> = {}
    // Object wrappers follow their item through reordering; primitives are edited by position.
    const getIndex = isRecord(item) ? () => this.resolveArrayItemIndex(field, item) : () => itemIndex

    if (isRecord(item)) {
      for (const innerKey of Object.keys(item)) {
        const child = item[innerKey]

        if (isPropertyAwareObject(child)) {
          wrapper[innerKey] = this.createObjectWrapperFromShape(
            child,
            (path) => this.getArrayItemValueByPath(field, getIndex(), [innerKey, ...path]),
            (path, value) => this.setArrayItemValueByPath(field, getIndex(), [innerKey, ...path], value),
            (path) => {
              const index = getIndex()
              return index < 0 ? [] : this.errors.getArrayItemFieldErrors(String(field), index, [innerKey, ...path].join('.'))
            },
            (path) => {
              const index = getIndex()
              return index < 0 ? false : this.getArrayItemDirty(field, index, [innerKey, ...path].join('.'))
            },
            () => this.touched[field] || false
          )
          continue
        }

        wrapper[innerKey] = this.createFieldProperty(
          () => this.getArrayItemValueByPath(field, getIndex(), [innerKey]) as typeof child,
          (newValue) => this.setArrayItemValueByPath(field, getIndex(), [innerKey], newValue),
          () => {
            const index = getIndex()
            return index < 0 ? [] : this.errors.getArrayItemFieldErrors(String(field), index, innerKey)
          },
          () => {
            const index = getIndex()
            return index < 0 ? false : this.getArrayItemDirty(field, index, innerKey)
          },
          () => this.touched[field] || false
        )
      }
    } else {
      wrapper['value'] = this.createFieldProperty(
        () => this.getArrayItemValueByPath(field, getIndex(), []) as ArrayItem<FormBody[K]>,
        (newValue) => this.setArrayItemValueByPath(field, getIndex(), [], newValue),
        () => {
          const index = getIndex()
          return index < 0 ? [] : this.errors.getArrayItemErrorMessages(String(field), index)
        },
        () => {
          const index = getIndex()
          return index < 0 ? false : this.getArrayItemDirtyValue(field, index)
        },
        () => this.touched[field] || false
      )
    }

    if (isRecord(item)) fieldCache.set(item, wrapper)
    return wrapper
  }

  private getOrCreateArrayWrappers<K extends keyof FormBody>(field: K, value: PropertyAwareArray<ArrayItem<FormBody[K]>>): Array<unknown> {
    let wrappers = this.arrayWrapperCache.get(field)
    if (!wrappers) {
      wrappers = []
      this.arrayWrapperCache.set(field, wrappers)
    }

    wrappers.length = 0
    value.forEach((item, index) => {
      wrappers!.push(this.getOrCreateArrayItemWrapper(field, item, index))
    })

    return wrappers
  }

  public get properties(): FormProperties<FormBody> {
    const props: Partial<FormProperties<FormBody>> = {}
    for (const key of Object.keys(this.state) as Array<FormKey<FormBody>>) {
      const value = this.state[key]
      if (value instanceof PropertyAwareArray) {
        props[key] = this.getOrCreateArrayWrappers(
          key,
          value as PropertyAwareArray<ArrayItem<FormBody[typeof key]>>
        ) as FormProperties<FormBody>[typeof key]
        continue
      }

      if (isPropertyAwareObject(value)) {
        props[key] = this.createObjectWrapperFromShape(
          value,
          (path) => {
            let current: unknown = this.state[key]
            for (const segment of path) {
              if (!isRecord(current)) {
                return undefined
              }

              current = current[segment]
            }
            return current
          },
          (path, newValue) => {
            const current: unknown = this.state[key]
            if (!isRecord(current)) {
              return
            }

            const segments = [...path]
            const last = segments.pop()
            if (last === undefined) {
              return
            }

            let record = current
            for (const segment of segments) {
              if (!isRecord(record[segment])) {
                return
              }
              record = record[segment]
            }

            record[last] = newValue
            this.edits.nestedFieldChanged(key, path)
          },
          (path) => this.errors.getObjectFieldErrors(String(key), path),
          (path) => getNestedDirtyValue(computeDirtyState(this.state[key], this.original[key]), path),
          () => this.touched[key] || false
        ) as FormProperties<FormBody>[typeof key]
        continue
      }

      props[key] = this.createFieldProperty(
        () => this._model[key].value,
        (newValue) => {
          this._model[key].value = newValue
        },
        () => this.errors.getFieldErrors(key),
        () => this.edits.isDirty(key),
        () => this.touched[key] || false
      ) as FormProperties<FormBody>[typeof key]
    }
    return props as FormProperties<FormBody>
  }
}
