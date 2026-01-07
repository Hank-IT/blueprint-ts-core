import { reactive, computed, toRaw, type ComputedRef, watch } from 'vue'
import { camelCase, upperFirst, cloneDeep, isEqual } from 'lodash-es'
import isEqualWith from 'lodash-es/isEqualWith'
import { type PersistedForm } from './types/PersistedForm'
import { NonPersistentDriver } from '../../service/persistenceDrivers/NonPersistentDriver'
import { type PersistenceDriver } from '../../service/persistenceDrivers/types/PersistenceDriver'
import { PropertyAwareArray } from './PropertyAwareArray'
import { BaseRule } from './validation/rules/BaseRule'
import { type BidirectionalRule } from './validation/types/BidirectionalRule'
import { ValidationMode } from './validation'

export function propertyAwareToRaw<T>(propertyAwareObject: any): T {
  // Prüfe, ob es sich um ein Array handelt
  if (Array.isArray(propertyAwareObject)) {
    return propertyAwareObject.map((item) => propertyAwareToRaw(item)) as T
  }

  // Wenn es kein Objekt ist oder null/undefined, direkt zurückgeben
  if (!propertyAwareObject || typeof propertyAwareObject !== 'object') {
    return propertyAwareObject as T
  }

  const result: any = {}

  for (const key in propertyAwareObject) {
    // Überspringen von prototyp-eigenschaften oder speziellen Eigenschaften
    if (!Object.prototype.hasOwnProperty.call(propertyAwareObject, key) || key.startsWith('_')) {
      continue
    }

    // Prüfen, ob die Eigenschaft ein model.value-Objekt hat
    if (propertyAwareObject[key]?.model?.value !== undefined) {
      result[key] = propertyAwareObject[key].model.value
    } else if (propertyAwareObject[key] && typeof propertyAwareObject[key] === 'object') {
      // Rekursiv für verschachtelte Objekte oder Arrays
      result[key] = propertyAwareToRaw(propertyAwareObject[key])
    } else {
      // Fallback für den Fall, dass es sich nicht um ein property-aware Feld handelt
      result[key] = propertyAwareObject[key]
    }
  }

  return result as T
}

/** Helper: shallow-merge source object into target. */
function shallowMerge(target: any, source: any): any {
  Object.assign(target, source)
  return target
}

/** Helper: if both values are arrays, update each element if possible, otherwise replace. */
function deepMergeArrays(target: any[], source: any[]): any[] {
  if (target.length !== source.length) {
    return source
  }
  return target.map((t, i) => {
    const s = source[i]
    if (t && typeof t === 'object' && s && typeof s === 'object') {
      return shallowMerge({ ...t }, s)
    }
    return s
  })
}

/**
 * Helper: Given the defaults and a state object (or original),
 * for every key where the default is a PropertyAwareArray, rewrap the value if needed.
 */
function restorePropertyAwareArrays<FormBody>(defaults: FormBody, state: FormBody): void {
  for (const key in defaults) {
    const defVal = defaults[key]
    if (defVal instanceof PropertyAwareArray) {
      // If state[key] is not an instance, assume it's a plain array and rewrap it.
      if (!(state[key] instanceof PropertyAwareArray)) {
        state[key] = new PropertyAwareArray(Array.isArray(state[key]) ? (state[key] as any) : []) as any
      }
    }
  }
}

function propertyAwareDeepEqual(a: any, b: any): boolean {
  // A helper that returns the "inner" value if it looks like a PropertyAwareArray.
  const getInner = (val: any) => {
    // If val is an instance of PropertyAwareArray, it's already an array
    if (val instanceof PropertyAwareArray) {
      return val
    }
    return val
  }

  return isEqualWith(a, b, (aValue, bValue) => {
    const normA = getInner(aValue)
    const normB = getInner(bValue)
    // If either normalization changed the value, compare the normalized ones.
    if (normA !== aValue || normB !== bValue) {
      return isEqual(normA, normB)
    }
    return undefined // use default comparison
  })
}

/**
 * A generic base class for forms.
 *
 * @template RequestBody - The final payload shape (what is sent to the server).
 * @template FormBody - The raw form data shape (before any mutators are applied).
 *
 * (We assume that for every key in RequestBody there is a corresponding key in FormBody.)
 */
export abstract class BaseForm<RequestBody extends object, FormBody extends object> {
  public readonly state: FormBody
  private readonly dirty: Record<keyof FormBody, boolean | any[]>
  private readonly touched: Record<keyof FormBody, boolean>
  private readonly original: FormBody
  private readonly _model: { [K in keyof FormBody]: ComputedRef<FormBody[K]> }
  private _errors: any = reactive({})
  private _suggestions: any = reactive({})
  private _hasErrors: ComputedRef<boolean>
  protected append: string[] = []
  protected ignore: string[] = []
  protected errorMap: { [serverKey: string]: string | string[] } = {}

  protected rules: Partial<
    Record<
      keyof FormBody,
      {
        rules: BaseRule<any>[]
        options?: { mode?: ValidationMode }
      }
    >
  > = {}

  private fieldDependencies: Map<keyof FormBody, Set<keyof FormBody>> = new Map()

  /**
   * Returns the persistence driver to use.
   * The default is a NonPersistentDriver.
   * Child classes can override this method to return a different driver.
   */
  protected getPersistenceDriver(_suffix: string | undefined): PersistenceDriver {
    return new NonPersistentDriver()
  }

  /**
   * Helper: recursively computes the dirty state for a value based on the original.
   * For plain arrays we compare the entire array (a single flag), not each element.
   */
  private computeDirtyState(current: any, original: any): any {
    if (Array.isArray(current) && Array.isArray(original)) {
      return current.length !== original.length || !isEqual(current, original)
    } else if (current && typeof current === 'object' && original && typeof original === 'object') {
      const dirty: Record<string, boolean> = {}
      for (const key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          dirty[key] = !isEqual(current[key], original[key])
        }
      }
      return dirty
    }
    return !isEqual(current, original)
  }

  /**
   * Build a map of field dependencies based on the rules
   * This identifies which fields need to be revalidated when another field changes
   */
  private buildFieldDependencies(): void {
    for (const field in this.rules) {
      if (Object.prototype.hasOwnProperty.call(this.rules, field)) {
        const fieldRules = this.rules[field as keyof FormBody]?.rules || []

        for (const rule of fieldRules) {
          // Process normal dependencies from dependsOn array
          for (const dependencyField of rule.dependsOn) {
            // Add this field as dependent on dependencyField
            if (!this.fieldDependencies.has(dependencyField as keyof FormBody)) {
              this.fieldDependencies.set(dependencyField as keyof FormBody, new Set())
            }

            this.fieldDependencies.get(dependencyField as keyof FormBody)?.add(field as keyof FormBody)
          }

          // Process bidirectional dependencies if rule implements BidirectionalRule
          if ('getBidirectionalFields' in rule && typeof (rule as any).getBidirectionalFields === 'function') {
            const bidirectionalRule = rule as unknown as BidirectionalRule
            const bidirectionalFields = bidirectionalRule.getBidirectionalFields()

            for (const bidirectionalField of bidirectionalFields) {
              // Add bidirectional dependency from this field to the other field
              if (!this.fieldDependencies.has(field as keyof FormBody)) {
                this.fieldDependencies.set(field as keyof FormBody, new Set())
              }

              this.fieldDependencies.get(field as keyof FormBody)?.add(bidirectionalField as unknown as keyof FormBody)
            }
          }
        }
      }
    }
  }

  /**
   * Validate fields that depend on the changed field
   */
  private validateDependentFields(changedField: keyof FormBody): void {
    const dependentFields = this.fieldDependencies.get(changedField)

    if (dependentFields) {
      const fieldsToValidate = new Set<keyof FormBody>(dependentFields)

      // For bidirectional dependencies
      for (const field of dependentFields) {
        const fieldDeps = this.fieldDependencies.get(field)
        if (fieldDeps && fieldDeps.has(changedField)) {
          fieldsToValidate.add(field)
          fieldsToValidate.add(changedField)
        }
      }

      // Validate dependent fields
      for (const field of fieldsToValidate) {
        this.validateField(field, {
          isDependentChange: true,
          isSubmitting: false
        })
      }
    }
  }

  protected constructor(
    defaults: FormBody,
    protected options?: { persist?: boolean; persistSuffix?: string }
  ) {
    const persist = options?.persist !== false
    let initialData: FormBody
    const driver = this.getPersistenceDriver(options?.persistSuffix)

    if (persist) {
      const persisted = driver.get<PersistedForm<FormBody>>(this.constructor.name)
      if (persisted && propertyAwareDeepEqual(defaults, persisted.original)) {
        initialData = persisted.state
        this.original = cloneDeep(persisted.original)
        this.dirty = reactive(persisted.dirty) as Record<keyof FormBody, boolean | any[]>
        this.touched = reactive(persisted.touched || {}) as Record<keyof FormBody, boolean>
        // Rewrap persisted values that were originally PropertyAwareArrays:
        restorePropertyAwareArrays(defaults, initialData)
        restorePropertyAwareArrays(defaults, this.original)
      } else {
        console.log('Discarding persisted data for ' + this.constructor.name + " because it doesn't match the defaults.")
        initialData = defaults
        this.original = cloneDeep(defaults)
        const initDirty: Partial<Record<keyof FormBody, boolean | any[]>> = {}
        const initTouched: Partial<Record<keyof FormBody, boolean>> = {}
        for (const key in defaults) {
          const value = defaults[key]
          // Initialize dirty state
          if (value instanceof PropertyAwareArray) {
            initDirty[key as keyof FormBody] = ([...value] as any[]).map((item) => {
              if (item && typeof item === 'object') {
                const obj: Record<string, boolean> = {}
                for (const k in item) {
                  if (Object.prototype.hasOwnProperty.call(item, k)) {
                    obj[k] = false
                  }
                }
                return obj
              }
              return false
            })
          } else {
            initDirty[key as keyof FormBody] = false
          }

          // Initialize touched state
          initTouched[key as keyof FormBody] = false
        }
        this.dirty = reactive(initDirty) as Record<keyof FormBody, boolean | any[]>
        this.touched = reactive(initTouched) as Record<keyof FormBody, boolean>
        driver.remove(this.constructor.name)
      }
    } else {
      initialData = defaults
      this.original = cloneDeep(defaults)
      const initDirty: Partial<Record<keyof FormBody, boolean | any[]>> = {}
      const initTouched: Partial<Record<keyof FormBody, boolean>> = {}
      for (const key in defaults) {
        const value = defaults[key]
        // Initialize dirty state
        if (value instanceof PropertyAwareArray) {
          initDirty[key as keyof FormBody] = ([...value] as any[]).map((item) => {
            if (item && typeof item === 'object') {
              const obj: Record<string, boolean> = {}
              for (const k in item) {
                if (Object.prototype.hasOwnProperty.call(item, k)) {
                  obj[k] = false
                }
              }
              return obj
            }
            return false
          })
        } else {
          initDirty[key as keyof FormBody] = false
        }

        // Initialize touched state
        initTouched[key as keyof FormBody] = false
      }
      this.dirty = reactive(initDirty) as Record<keyof FormBody, boolean | any[]>
      this.touched = reactive(initTouched) as Record<keyof FormBody, boolean>
    }

    this.rules = this.defineRules()

    // Build the field dependencies map before creating computed properties
    this.buildFieldDependencies()

    this.state = reactive(initialData) as FormBody
    this._model = {} as { [K in keyof FormBody]: ComputedRef<FormBody[K]> }

    // Create computed models.
    for (const key in this.state) {
      const value = this.state[key]
      if (value instanceof PropertyAwareArray) {
        this._model[key as keyof FormBody] = computed({
          get: () => this.state[key],
          set: (newVal: any) => {
            const arr = this.state[key] as PropertyAwareArray
            // Leere das Array und fülle es neu
            arr.length = 0
            if (Array.isArray(newVal)) {
              newVal.forEach((item) => arr.push(item))
            }
            this.dirty[key as keyof FormBody] = (newVal as any[]).map(() => false)
            this.touched[key as keyof FormBody] = true

            // Validate this field
            this.validateField(key as keyof FormBody)

            // Also validate any fields that depend on this field
            this.validateDependentFields(key as keyof FormBody)

            if (persist) {
              driver.set(this.constructor.name, {
                state: toRaw(this.state),
                original: toRaw(this.original),
                dirty: toRaw(this.dirty),
                touched: toRaw(this.touched)
              } as PersistedForm<FormBody>)
            }
          }
        })
      } else {
        this._model[key as keyof FormBody] = computed({
          get: () => this.state[key],
          set: (value: FormBody[typeof key]) => {
            this.state[key] = value
            this.dirty[key as keyof FormBody] = this.computeDirtyState(value, this.original[key])
            this.touched[key as keyof FormBody] = true

            // Validate this field
            this.validateField(key as keyof FormBody)

            // Also validate any fields that depend on this field
            this.validateDependentFields(key as keyof FormBody)

            if (persist) {
              driver.set(this.constructor.name, {
                state: toRaw(this.state),
                original: toRaw(this.original),
                dirty: toRaw(this.dirty),
                touched: toRaw(this.touched)
              } as PersistedForm<FormBody>)
            }
          }
        })
      }
    }

    // Add a deep watch for plain arrays to update the dirty state if in-place changes occur.
    for (const key in this.state) {
      const value = this.state[key]
      if (Array.isArray(value) && !(value instanceof PropertyAwareArray)) {
        watch(
          () => this.state[key],
          (newVal) => {
            this.dirty[key as keyof FormBody] = this.computeDirtyState(newVal, this.original[key])
            this.touched[key as keyof FormBody] = true
          },
          { deep: true }
        )
      }
    }

    // Create computed property for checking errors
    this._hasErrors = computed(() => {
      // Check if any field has errors
      for (const field in this._errors) {
        if (Object.prototype.hasOwnProperty.call(this._errors, field)) {
          const fieldErrors = this._errors[field]

          // Handle string array errors
          if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
            return true
          }

          // Handle nested array errors
          if (fieldErrors && typeof fieldErrors === 'object') {
            // For arrays of objects with errors
            if (Array.isArray(fieldErrors)) {
              for (const item of fieldErrors) {
                if (item && typeof item === 'object' && Object.keys(item).length > 0) {
                  return true
                }
              }
            }
            // For plain objects with errors
            else if (Object.keys(fieldErrors).length > 0) {
              return true
            }
          }
        }
      }

      return false
    })

    if (persist) {
      watch(
        () => this.state,
        () => {
          driver.set(this.constructor.name, {
            state: toRaw(this.state),
            original: toRaw(this.original),
            dirty: toRaw(this.dirty),
            touched: toRaw(this.touched)
          } as PersistedForm<FormBody>)
        },
        { deep: true, immediate: true }
      )
    }

    this.validate()
  }

  protected defineRules(): { [K in keyof FormBody]?: { rules: BaseRule<any>[]; options?: { mode?: ValidationMode } } } {
    return {}
  }

  public fillErrors<ErrorInterface>(errorsData: ErrorInterface): void {
    for (const key in this._errors) {
      delete this._errors[key]
    }

    for (const serverKey in errorsData) {
      if (Object.prototype.hasOwnProperty.call(errorsData, serverKey)) {
        const errorMessage = errorsData[serverKey]

        let targetKeys: string[] = [serverKey]

        const mapping = this.errorMap?.[serverKey]
        if (mapping) {
          targetKeys = Array.isArray(mapping) ? mapping : [mapping]
        }

        for (const targetKey of targetKeys) {
          const parts = targetKey.split('.')
          if (parts.length > 1) {
            const topKey = parts[0]
            // @ts-ignore index could be NaN if part is not a number
            const index = parseInt(parts[1], 10)
            const errorSubKey = parts.slice(2).join('.')

            // @ts-ignore Dynamic property access
            if (!this._errors[topKey]) {
              // @ts-ignore Dynamic property access
              this._errors[topKey] = []
            }
            // @ts-ignore Dynamic property access, index could be NaN
            if (!this._errors[topKey][index]) {
              // @ts-ignore Dynamic property access, index could be NaN
              this._errors[topKey][index] = {}
            }

            // @ts-ignore Dynamic property access, index could be NaN
            this._errors[topKey][index][errorSubKey] = errorMessage
          } else {
            this._errors[targetKey] = errorMessage
          }
        }
      }
    }
  }

  /**
   * Mark a field as touched, which indicates user interaction
   * Optionally triggers validation
   * @param field The field to mark as touched
   */
  public touch(field: keyof FormBody): void {
    this.touched[field] = true

    // Get field config to check if we should validate on touch
    const fieldConfig = this.rules[field]
    if (fieldConfig) {
      const mode = fieldConfig.options?.mode ?? ValidationMode.DEFAULT

      // Validate if ON_TOUCH flag is set
      if (mode & ValidationMode.ON_TOUCH) {
        this.validateField(field, {
          isSubmitting: false,
          isDependentChange: false
        })
      }
    }

    // Persist the touched state if persistence is enabled
    if (this.options?.persist !== false) {
      const driver = this.getPersistenceDriver(this.options?.persistSuffix)
      driver.set(this.constructor.name, {
        state: toRaw(this.state),
        original: toRaw(this.original),
        dirty: toRaw(this.dirty),
        touched: toRaw(this.touched)
      } as PersistedForm<FormBody>)
    }
  }

  /**
   * Check if a field has been touched (user interacted with it)
   * @param field The field to check
   * @returns boolean indicating if the field has been touched
   */
  public isTouched(field: keyof FormBody): boolean {
    return !!this.touched[field]
  }

  protected validateField(
    field: keyof FormBody,
    context: {
      isDirty?: boolean
      isSubmitting?: boolean
      isDependentChange?: boolean
      isTouched?: boolean
    } = {}
  ): void {
    // Clear existing errors for this field
    this._errors[field] = []

    const value = this.state[field]

    // Get field rules and options
    const fieldConfig = this.rules[field]
    if (!fieldConfig?.rules || fieldConfig.rules.length === 0) {
      return // No rules to validate
    }

    // Default to ON_DIRTY | ON_SUBMIT if no mode is specified
    const mode = fieldConfig.options?.mode ?? ValidationMode.DEFAULT

    // Use the field's actual states if not provided in context
    const isDirty = context.isDirty !== undefined ? context.isDirty : this.isDirty(field)
    const isTouched = context.isTouched !== undefined ? context.isTouched : this.isTouched(field)

    // Determine if we should validate based on the context and mode
    const shouldValidate =
      // Force validation on submit if ON_SUBMIT flag is set
      (context.isSubmitting && mode & ValidationMode.ON_SUBMIT) ||
      // Validate if field is dirty and ON_DIRTY flag is set
      (isDirty && mode & ValidationMode.ON_DIRTY) ||
      // Validate if field is touched and ON_TOUCH flag is set
      (isTouched && mode & ValidationMode.ON_TOUCH) ||
      // Validate instantly if INSTANTLY flag is set
      mode & ValidationMode.INSTANTLY ||
      // Validate if a dependent field changed and ON_DEPENDENT_CHANGE flag is set
      (context.isDependentChange && mode & ValidationMode.ON_DEPENDENT_CHANGE)

    if (shouldValidate) {
      // Run each validation rule, passing the entire form state
      for (const rule of fieldConfig.rules) {
        const isValid = rule.validate(value, this.state)
        if (!isValid) {
          // If validation fails, add the error message
          if (!this._errors[field]) {
            this._errors[field] = []
          }
          this._errors[field].push(rule.getMessage())
        }
      }
    }
  }

  public validate(isSubmitting: boolean = false): boolean {
    let isValid = true

    // Clear all errors
    for (const key in this._errors) {
      delete this._errors[key]
    }

    // Validate each field with rules
    for (const field in this.rules) {
      if (Object.prototype.hasOwnProperty.call(this.rules, field)) {
        // Validate with context, using field-specific states
        this.validateField(field as keyof FormBody, {
          isSubmitting,
          isDependentChange: false,
          isTouched: this.isTouched(field as keyof FormBody)
        })

        // If there are errors, the form is invalid
        if (this._errors[field] && this._errors[field].length > 0) {
          isValid = false
        }
      }
    }

    return isValid
  }

  public fillState(data: Partial<FormBody>): void {
    const driver = this.getPersistenceDriver(this.options?.persistSuffix)
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key) && key in this.state) {
        const currentVal = this.state[key]
        const newVal = data[key]
        if (currentVal instanceof PropertyAwareArray) {
          const arr = this.state[key] as PropertyAwareArray
          // Leere das Array und fülle es neu
          arr.length = 0

          if (Array.isArray(newVal)) {
            newVal.forEach((item) => arr.push(item))
          } else if (newVal instanceof PropertyAwareArray) {
            ;[...newVal].forEach((item) => arr.push(item))
          }

          this.dirty[key as keyof FormBody] = ([...arr] as any[]).map(() => false)
          this.touched[key as keyof FormBody] = true
        } else if (Array.isArray(newVal) && Array.isArray(currentVal)) {
          if (newVal.length === currentVal.length) {
            this.state[key] = deepMergeArrays(currentVal, newVal) as any
          } else {
            this.state[key] = newVal as any
          }
          this.dirty[key as keyof FormBody] = this.computeDirtyState(this.state[key], this.original[key])
          this.touched[key as keyof FormBody] = true
        } else if (newVal && typeof newVal === 'object' && currentVal && typeof currentVal === 'object') {
          this.state[key] = shallowMerge({ ...currentVal }, newVal)
          this.dirty[key as keyof FormBody] = this.computeDirtyState(this.state[key], this.original[key])
          this.touched[key as keyof FormBody] = true
        } else {
          this.state[key] = newVal as any
          this.dirty[key as keyof FormBody] = this.computeDirtyState(this.state[key], this.original[key])
          this.touched[key as keyof FormBody] = true
        }
      }
    }
    driver.set(this.constructor.name, {
      state: toRaw(this.state),
      original: toRaw(this.original),
      dirty: toRaw(this.dirty),
      touched: toRaw(this.touched)
    } as PersistedForm<FormBody>)

    // Validate affected fields and their dependencies
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key) && key in this.state) {
        this.validateField(key as keyof FormBody)
        this.validateDependentFields(key as keyof FormBody)
      }
    }
  }

  public fillSuggestions(suggestionsData: Partial<Record<keyof FormBody, string[] | object[]>>): void {
    for (const key in suggestionsData) {
      if (Object.prototype.hasOwnProperty.call(suggestionsData, key)) {
        this._suggestions[key] = suggestionsData[key]
      }
    }
  }

  private transformValue(value: any, parentKey?: string): any {
    if (value instanceof PropertyAwareArray) {
      return [...value].map((item) => this.transformValue(item, parentKey))
    }
    if (Array.isArray(value)) {
      // For plain arrays, you might want to map them too:
      return value.map((item) => this.transformValue(item, parentKey))
    } else if (value && typeof value === 'object') {
      const result: any = {}
      for (const prop in value) {
        if (parentKey) {
          const compositeMethod = 'get' + upperFirst(parentKey) + upperFirst(camelCase(prop))
          if (typeof (this as any)[compositeMethod] === 'function') {
            result[prop] = (this as any)[compositeMethod](value[prop])
            continue
          }
        }
        // Pass the parentKey along so that nested objects still use it.
        result[prop] = this.transformValue(value[prop], parentKey)
      }
      return result
    }
    return value
  }

  public buildPayload(): RequestBody {
    const payload = {} as RequestBody
    for (const key in this.state) {
      if (this.ignore.includes(key)) {
        continue
      }

      const value = this.state[key]

      const getterName = 'get' + upperFirst(camelCase(key))
      const typedKey = key as unknown as keyof RequestBody
      if (typeof (this as any)[getterName] === 'function') {
        payload[typedKey] = (this as any)[getterName](value)
      } else {
        payload[typedKey] = this.transformValue(value, key)
      }
    }

    for (const fieldName of this.append) {
      if (Array.isArray(this.ignore) && this.ignore.includes(fieldName)) {
        console.warn(`Appended field '${fieldName}' is also in ignore list in ${this.constructor.name}. It will be skipped.`)
        continue
      }

      const getterName = 'get' + upperFirst(camelCase(fieldName))
      if (typeof (this as any)[getterName] === 'function') {
        payload[fieldName as keyof RequestBody] = (this as any)[getterName]()
      } else {
        console.warn(`Getter method '${getterName}' not found for appended field '${fieldName}' in ${this.constructor.name}.`)
      }
    }

    return payload
  }

  public reset(): void {
    const driver = this.getPersistenceDriver(this.options?.persistSuffix)
    for (const key in this.state) {
      if (this.state[key] instanceof PropertyAwareArray) {
        const stateArr = this.state[key] as PropertyAwareArray
        const originalValue = this.original[key] as PropertyAwareArray

        stateArr.length = 0
        ;[...originalValue].forEach((item) => stateArr.push(cloneDeep(item)))

        this.dirty[key as keyof FormBody] = ([...stateArr] as any[]).map(() => false)
        this.touched[key as keyof FormBody] = false
      } else if (Array.isArray(this.original[key])) {
        this.state[key] = cloneDeep(this.original[key])
        this.dirty[key as keyof FormBody] = this.computeDirtyState(this.state[key], this.original[key])
        this.touched[key as keyof FormBody] = false
      } else {
        this.state[key] = cloneDeep(this.original[key])
        this.dirty[key as keyof FormBody] = false
        this.touched[key as keyof FormBody] = false
      }
    }
    for (const key in this._errors) {
      delete this._errors[key]
    }
    for (const key in this._suggestions) {
      delete this._suggestions[key]
    }
    driver.set(this.constructor.name, {
      state: toRaw(this.state),
      original: toRaw(this.original),
      dirty: toRaw(this.dirty),
      touched: toRaw(this.touched)
    } as PersistedForm<FormBody>)

    // Revalidate the form after reset
    this.validate()
  }

  protected addToArrayProperty(property: keyof FormBody, newElement: any): void {
    const driver = this.getPersistenceDriver(this.options?.persistSuffix)
    const arr = this.state[property]
    if (arr instanceof PropertyAwareArray) {
      arr.push(newElement)
      this.touched[property] = true
      driver.set(this.constructor.name, {
        state: toRaw(this.state),
        original: toRaw(this.original),
        dirty: toRaw(this.dirty),
        touched: toRaw(this.touched)
      } as PersistedForm<FormBody>)

      return
    }

    if (!Array.isArray(arr)) {
      throw new Error(`Property "${String(property)}" is not an array.`)
    }

    arr.push(newElement)
    this.dirty[property] = this.computeDirtyState(arr, this.original[property])
    this.touched[property] = true
    driver.set(this.constructor.name, {
      state: toRaw(this.state),
      original: toRaw(this.original),
      dirty: toRaw(this.dirty),
      touched: toRaw(this.touched)
    } as PersistedForm<FormBody>)

    // Validate the array field after modification
    this.validateField(property)
    this.validateDependentFields(property)
  }

  protected removeArrayItem(arrayIndex: string, filter: (item: any) => boolean): void {
    // @ts-expect-error
    const current = this.state[arrayIndex]
    if (current instanceof PropertyAwareArray) {
      // Filter-Funktion auf PropertyAwareArray anwenden und Ergebnis zurückschreiben
      const filtered = [...current].filter(filter)
      current.length = 0
      filtered.forEach((item) => current.push(item))
    } else if (Array.isArray(current)) {
      // @ts-expect-error
      this.state[arrayIndex] = current.filter(filter)
    }

    // Mark the array as touched
    this.touched[arrayIndex as keyof FormBody] = true

    // Validate the array field after modification
    this.validateField(arrayIndex as keyof FormBody)
    this.validateDependentFields(arrayIndex as keyof FormBody)
  }

  protected resetArrayCounter(arrayIndex: string, counterIndex: string): void {
    let count = 1
    // @ts-expect-error
    const current = this.state[arrayIndex]
    if (current instanceof PropertyAwareArray) {
      ;[...current].forEach((item: any): void => {
        item[counterIndex] = count
        count++
      })
    } else if (Array.isArray(current)) {
      current.forEach((item: any): void => {
        item[counterIndex] = count
        count++
      })
    }

    // Mark the array as touched
    this.touched[arrayIndex as keyof FormBody] = true
  }

  public get properties(): { [K in keyof FormBody]: any } {
    const props: any = {}
    for (const key in this.state) {
      const value = this.state[key]
      if (value instanceof PropertyAwareArray) {
        props[key] = [...value].map((item, index) => {
          const elementProps: any = {}
          if (item && typeof item === 'object') {
            for (const innerKey in item) {
              elementProps[innerKey] = {
                model: computed({
                  get: () => (this.state[key] as PropertyAwareArray)[index][innerKey],
                  set: (newVal) => {
                    ;(this.state[key] as PropertyAwareArray)[index][innerKey] = newVal
                    const updatedElement = (this.state[key] as PropertyAwareArray)[index]
                    const originalElement = (this.original[key] as PropertyAwareArray)[index]
                    ;(this.dirty[key] as any[])[index] = this.computeDirtyState(updatedElement, originalElement)
                    this.touched[key] = true

                    // Validate after changing array items
                    this.validateField(key as keyof FormBody)
                    this.validateDependentFields(key as keyof FormBody)
                  }
                }),
                errors: (this._errors[key] && this._errors[key][index] && this._errors[key][index][innerKey]) || [],
                suggestions: (this._suggestions[key] && this._suggestions[key][index] && this._suggestions[key][index][innerKey]) || [],
                dirty:
                  Array.isArray(this.dirty[key]) && this.dirty[key][index] && typeof (this.dirty[key] as any[])[index] === 'object'
                    ? (this.dirty[key] as any[])[index][innerKey]
                    : false,
                touched: this.touched[key] || false
              }
            }
          } else {
            elementProps.value = {
              model: computed({
                get: () => (this.state[key] as PropertyAwareArray)[index],
                set: (newVal) => {
                  ;(this.state[key] as PropertyAwareArray)[index] = newVal
                  const updatedValue = (this.state[key] as PropertyAwareArray)[index]
                  const originalValue = (this.original[key] as PropertyAwareArray)[index]
                  ;(this.dirty[key] as boolean[])[index] = !isEqual(updatedValue, originalValue)
                  this.touched[key] = true

                  // Validate after changing array items
                  this.validateField(key as keyof FormBody)
                  this.validateDependentFields(key as keyof FormBody)
                }
              }),
              errors: (this._errors[key] && this._errors[key][index]) || [],
              suggestions: (this._suggestions[key] && this._suggestions[key][index]) || [],
              dirty: Array.isArray(this.dirty[key]) ? (this.dirty[key] as boolean[])[index] : false,
              touched: this.touched[key] || false
            }
          }
          return elementProps
        })
      } else {
        props[key] = {
          model: this._model[key],
          errors: this._errors[key] || [],
          suggestions: this._suggestions[key] || [],
          dirty: this.dirty[key] || false,
          touched: this.touched[key] || false
        }
      }
    }
    return props
  }

  /**
   * Checks if the form or a specific field is dirty
   * @param field Optional field name to check, if not provided checks the entire form
   * @returns boolean indicating if the form or specified field is dirty
   */
  public isDirty(field?: keyof FormBody): boolean {
    // If a specific field is provided, check only that field
    if (field !== undefined) {
      const dirtyState = this.dirty[field]

      // Handle different types of dirty state
      if (typeof dirtyState === 'boolean') {
        return dirtyState
      }

      if (Array.isArray(dirtyState)) {
        return dirtyState.some((item) => {
          if (typeof item === 'boolean') {
            return item
          }
          if (item && typeof item === 'object') {
            return Object.values(item).some((v) => v === true)
          }
          return false
        })
      }

      if (dirtyState && typeof dirtyState === 'object') {
        return Object.values(dirtyState).some((v) => v === true)
      }

      return false
    }

    // Check all fields (original behavior)
    for (const key in this.dirty) {
      const dirtyState = this.dirty[key as keyof FormBody]

      if (typeof dirtyState === 'boolean' && dirtyState) {
        return true
      }

      if (Array.isArray(dirtyState)) {
        for (const item of dirtyState) {
          if (typeof item === 'boolean' && item) {
            return true
          }
          if (item && typeof item === 'object' && Object.values(item).some((v) => v === true)) {
            return true
          }
        }
      }

      if (dirtyState && typeof dirtyState === 'object' && Object.values(dirtyState).some((v) => v === true)) {
        return true
      }
    }

    return false
  }

  /**
   * Returns whether the form has any validation errors
   * @returns boolean indicating if the form has any errors
   */
  public hasErrors(): boolean {
    return this._hasErrors.value
  }

  /**
   * Updates both the state and original value for a given property,
   * keeping the field in a clean (not dirty) state.
   * Supports all field types including PropertyAwareArray.
   *
   * @param key The property key to update
   * @param value The new value to set
   */
  public syncValue<K extends keyof FormBody>(key: K, value: FormBody[K]): void {
    const driver = this.getPersistenceDriver(this.options?.persistSuffix)
    const currentVal = this.state[key]

    // Handle PropertyAwareArray
    if (currentVal instanceof PropertyAwareArray) {
      const arr = this.state[key] as PropertyAwareArray
      const originalArr = this.original[key] as PropertyAwareArray

      // Clear arrays
      arr.length = 0
      originalArr.length = 0

      // Fill both arrays with the new value
      if (Array.isArray(value)) {
        value.forEach((item) => {
          arr.push(cloneDeep(item))
          originalArr.push(cloneDeep(item))
        })
      } else if (value instanceof PropertyAwareArray) {
        ;[...value].forEach((item) => {
          arr.push(cloneDeep(item))
          originalArr.push(cloneDeep(item))
        })
      }

      // Reset dirty state for this array
      this.dirty[key] = ([...arr] as any[]).map(() => false)
      // Mark as touched
      this.touched[key] = true
    }
    // Handle regular arrays
    else if (Array.isArray(currentVal)) {
      this.state[key] = cloneDeep(value)
      this.original[key] = cloneDeep(value)
      this.dirty[key] = false
      this.touched[key] = true
    }
    // Handle objects
    else if (typeof currentVal === 'object' && currentVal !== null) {
      this.state[key] = cloneDeep(value)
      this.original[key] = cloneDeep(value)
      this.dirty[key] = false
      this.touched[key] = true
    }
    // Handle primitive values
    else {
      this.state[key] = value
      this.original[key] = value
      this.dirty[key] = false
      this.touched[key] = true
    }

    // Update persistence if enabled
    if (this.options?.persist !== false) {
      driver.set(this.constructor.name, {
        state: toRaw(this.state),
        original: toRaw(this.original),
        dirty: toRaw(this.dirty),
        touched: toRaw(this.touched)
      } as PersistedForm<FormBody>)
    }

    // Validate the field and any dependent fields
    this.validateField(key)
    this.validateDependentFields(key)
  }
}
