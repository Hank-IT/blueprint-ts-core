import { reactive, computed, toRaw, type ComputedRef, type WritableComputedRef, watch } from 'vue'
import { camelCase, upperFirst, cloneDeep, debounce, isEqual, type DebouncedFunc } from 'lodash-es'
import { type PersistedForm } from './types/PersistedForm'
import { NonPersistentDriver } from '../../persistenceDrivers/NonPersistentDriver'
import { type PersistenceDriver } from '../../persistenceDrivers/types/PersistenceDriver'
import { PropertyAwareArray, type PropertyAwareField } from './PropertyAwareArray'
import { PropertyAwareObject, PROPERTY_AWARE_OBJECT_MARKER } from './PropertyAwareObject'
import { StrictPersistenceRestorePolicy } from './persistence/StrictPersistenceRestorePolicy'
import { type PersistenceDebugEvent, type PersistenceRestorePolicy } from './persistence/types'
import { BaseRule } from './validation/rules/BaseRule'
import { ValidationMode, type ValidationGroups, type ValidationRules } from './validation'

interface DirtyObject {
  [key: string]: DirtyState
}
type DirtyArray = Array<boolean | DirtyObject>
type DirtyState = boolean | DirtyObject | DirtyArray
type DirtyMap<FormBody extends object> = Record<keyof FormBody, DirtyState>

type ErrorMessages = string[]
interface ErrorObject {
  [key: string]: FieldErrors
}
type ErrorArray = Array<ErrorObject>
type FieldErrors = ErrorMessages | ErrorObject | ErrorArray
type ErrorBag = Record<string, FieldErrors>

type FieldProperty<T> = PropertyAwareField<T>

type NestedPropertyAwareValue<T> =
  T extends PropertyAwareArray<infer Item>
    ? ArrayProperty<Item>
    : T extends PropertyAwareObject<infer Shape>
      ? ObjectProperty<Shape>
      : FieldProperty<T>

type ArrayProperty<T> = Array<T extends object ? { [P in keyof T]: NestedPropertyAwareValue<T[P]> } : { value: FieldProperty<T> }>
type ObjectProperty<T extends object> = { [K in keyof T]: NestedPropertyAwareValue<T[K]> }

type PropertyAwareToRaw<T> =
  T extends Array<infer U>
    ? Array<PropertyAwareToRaw<U>>
    : T extends PropertyAwareObject<infer Shape>
      ? { [K in keyof Shape]: PropertyAwareToRaw<Shape[K]> }
      : T extends { model: { value: infer V } }
        ? V
        : T extends object
          ? { [K in keyof T]: PropertyAwareToRaw<T[K]> }
          : T

type FormKey<FormBody extends object> = Extract<keyof FormBody, string>
type RequestKey<RequestBody extends object> = Extract<keyof RequestBody, string>
type ArrayItem<T> = T extends Array<infer Item> ? Item : never
type PropertyAwareInput<T> = T extends PropertyAwareArray<infer Item> ? Array<Item> | PropertyAwareArray<Item> : T

type FormProperties<FormBody extends object> = {
  [K in keyof FormBody]: FormBody[K] extends PropertyAwareArray<infer Item>
    ? ArrayProperty<Item>
    : FormBody[K] extends PropertyAwareObject<infer Shape>
      ? ObjectProperty<Shape>
      : FieldProperty<FormBody[K]>
}

interface ValidationContext {
  isDirty?: boolean
  isSubmitting?: boolean
  isDependentChange?: boolean
  isTouched?: boolean
}

interface AsyncValidationContext extends ValidationContext {
  skipSyncValidation?: boolean
  skipAsyncValidation?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isErrorMessages(value: unknown): value is ErrorMessages {
  return Array.isArray(value) && (value.length === 0 || typeof value[0] === 'string')
}

function isErrorArray(value: unknown): value is ErrorArray {
  return Array.isArray(value) && value.some((item) => isRecord(item))
}

function isErrorObject(value: unknown): value is ErrorObject {
  return isRecord(value)
}

function isPropertyAwareObject(value: unknown): value is PropertyAwareObject<object> {
  return value instanceof PropertyAwareObject
}

function isSerializedPropertyAwareObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && value[PROPERTY_AWARE_OBJECT_MARKER] === true
}

function restoreSerializedPropertyAwareValue<T>(value: T): T {
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
    const modelValue = isRecord(value) ? (value as { model?: { value?: unknown } }).model?.value : undefined

    if (modelValue !== undefined) {
      result[key] = modelValue
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
function shallowMerge<T extends object, U extends object>(target: T, source: U): T & U {
  Object.assign(target, source)
  return target as T & U
}

/** Helper: if both values are arrays, update each element if possible, otherwise replace. */
function deepMergeArrays<T>(target: T[], source: T[]): T[] {
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

function restorePropertyAwareStructure<T>(defaults: T, value: unknown): T {
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
    const restored =
      value instanceof PropertyAwareObject
        ? value
        : new PropertyAwareObject(isRecord(value) ? (value as Record<string, unknown>) : ({} as Record<string, unknown>))
    const restoredRecord = restored as Record<string, unknown>
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

/**
 * A generic base class for forms.
 *
 * @template RequestBody - The final payload shape (what is sent to the server).
 * @template FormBody - The raw form data shape (before mutators are applied).
 *
 * (We assume that for every key in RequestBody there is a corresponding key in FormBody.)
 */
export abstract class BaseForm<RequestBody extends object, FormBody extends object> {
  protected readonly state: FormBody
  private readonly dirty: DirtyMap<FormBody>
  private readonly touched: Record<keyof FormBody, boolean>
  private readonly original: FormBody
  private readonly _model: { [K in keyof FormBody]: WritableComputedRef<FormBody[K]> }
  private _errors: ErrorBag = reactive<ErrorBag>({})
  private _asyncErrors: ErrorBag = reactive<ErrorBag>({})
  private _hasErrors: ComputedRef<boolean>
  protected append: string[] = []
  protected ignore: string[] = []
  protected errorMap: { [serverKey: string]: string | string[] } = {}

  protected rules: ValidationRules<FormBody> = {}
  protected validationGroups: ValidationGroups<FormBody> = {}

  private fieldDependencies: Map<keyof FormBody, Set<keyof FormBody>> = new Map()
  private readonly arrayWrapperCache = new Map<keyof FormBody, Array<unknown>>()
  private readonly arrayItemWrapperCache = new Map<keyof FormBody, WeakMap<object, Record<string, unknown>>>()
  private readonly asyncValidationDebouncers = new Map<keyof FormBody, DebouncedFunc<() => void>>()
  private readonly pendingAsyncValidationContexts = new Map<keyof FormBody, { token: number; context: ValidationContext }>()
  private readonly asyncValidationTokens = reactive<Record<string, number>>({})

  /**
   * Returns the persistence driver to use.
   * The default is a NonPersistentDriver.
   * Child classes can override this method to return a different driver.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected getPersistenceDriver(_suffix: string | undefined): PersistenceDriver {
    return new NonPersistentDriver()
  }

  protected getPersistenceRestorePolicy(): PersistenceRestorePolicy<FormBody> {
    return new StrictPersistenceRestorePolicy<FormBody>()
  }

  protected shouldLogPersistenceDebug(): boolean {
    return false
  }

  protected logPersistenceDebug(event: PersistenceDebugEvent<FormBody>): void {
    if (!this.shouldLogPersistenceDebug()) {
      return
    }

    const suffixLabel = event.persistSuffix ? ` (${event.persistSuffix})` : ''
    const details = event.details ? ` ${JSON.stringify(event.details)}` : ''

    console.debug(`[BaseForm persistence] ${event.formName}${suffixLabel}: ${event.action} (${event.reason})${details}`)
  }

  /**
   * Helper: recursively computes the dirty state for a value based on the original.
   * For plain arrays we compare the entire array (a single flag), not each element.
   */
  private computeDirtyState<T>(current: T, original: T): DirtyState {
    if (Array.isArray(current) && Array.isArray(original)) {
      return current.length !== original.length || !isEqual(current, original)
    } else if (current && typeof current === 'object' && original && typeof original === 'object') {
      const dirty: DirtyObject = {}
      for (const key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          dirty[key] = this.computeDirtyState(current[key], original[key])
        }
      }
      return dirty
    }
    return !isEqual(current, original)
  }

  private initDirtyTouched(defaults: FormBody): {
    dirty: DirtyMap<FormBody>
    touched: Record<keyof FormBody, boolean>
  } {
    const initDirty: Partial<DirtyMap<FormBody>> = {}
    const initTouched: Partial<Record<keyof FormBody, boolean>> = {}

    for (const key in defaults) {
      const value = defaults[key]
      if (value instanceof PropertyAwareArray) {
        initDirty[key as keyof FormBody] = Array.from(value).map((item) => {
          if (item && typeof item === 'object') {
            const obj: DirtyObject = {}
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

      initTouched[key as keyof FormBody] = false
    }

    return {
      dirty: reactive(initDirty) as DirtyMap<FormBody>,
      touched: reactive(initTouched) as Record<keyof FormBody, boolean>
    }
  }

  private replacePropertyAwareArray<K extends keyof FormBody>(key: K, values: Array<ArrayItem<FormBody[K]>>): void {
    const current = this.state[key]
    if (current instanceof PropertyAwareArray) {
      current.length = 0
      values.forEach((item) => current.push(item))
      return
    }

    this.state[key] = new PropertyAwareArray(values) as FormBody[K]
  }

  private persistState(driver?: PersistenceDriver): void {
    if (this.options?.persist === false) {
      return
    }

    const persistDriver = driver ?? this.getPersistenceDriver(this.options?.persistSuffix)
    persistDriver.set(this.constructor.name, {
      state: toRaw(this.state),
      original: toRaw(this.original),
      dirty: toRaw(this.dirty),
      touched: toRaw(this.touched)
    } as PersistedForm<FormBody>)
  }

  private markFieldUpdated(key: keyof FormBody, driver?: PersistenceDriver): void {
    this.touched[key] = true
    this.validateField(key)
    this.validateDependentFields(key)
    this.persistState(driver)
  }

  private updateField<K extends keyof FormBody>(key: K, value: FormBody[K], driver?: PersistenceDriver): void {
    this.state[key] = value
    this.dirty[key] = this.computeDirtyState(value, this.original[key])
    this.markFieldUpdated(key, driver)
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
          for (const dependencyField of rule.dependsOn) {
            if (!this.fieldDependencies.has(dependencyField as keyof FormBody)) {
              this.fieldDependencies.set(dependencyField as keyof FormBody, new Set())
            }

            this.fieldDependencies.get(dependencyField as keyof FormBody)?.add(field as keyof FormBody)
          }

          const bidirectionalFields = rule.getBidirectionalFields?.()
          if (bidirectionalFields && bidirectionalFields.length > 0) {
            for (const bidirectionalField of bidirectionalFields) {
              if (!this.fieldDependencies.has(field as keyof FormBody)) {
                this.fieldDependencies.set(field as keyof FormBody, new Set())
              }

              this.fieldDependencies.get(field as keyof FormBody)?.add(bidirectionalField)
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

      for (const field of dependentFields) {
        const fieldDeps = this.fieldDependencies.get(field)
        if (fieldDeps && fieldDeps.has(changedField)) {
          fieldsToValidate.add(field)
          fieldsToValidate.add(changedField)
        }
      }

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
      const persisted = driver.get<PersistedForm<FormBody>>(this.constructor.name) ?? null
      const restoreDecision = this.getPersistenceRestorePolicy().resolve({
        formName: this.constructor.name,
        persistSuffix: options?.persistSuffix,
        defaults,
        persisted
      })

      this.logPersistenceDebug({
        formName: this.constructor.name,
        persistSuffix: options?.persistSuffix,
        action: restoreDecision.action,
        reason: restoreDecision.reason,
        details: restoreDecision.details
      })

      if (restoreDecision.action === 'restore' && restoreDecision.persisted) {
        initialData = restorePropertyAwareStructure(defaults, restoreDecision.persisted.state)
        this.original = restorePropertyAwareStructure(defaults, cloneDeep(restoreDecision.persisted.original))
        this.dirty = reactive(restoreDecision.persisted.dirty) as DirtyMap<FormBody>
        this.touched = reactive(restoreDecision.persisted.touched || {}) as Record<keyof FormBody, boolean>
      } else {
        initialData = defaults
        this.original = restorePropertyAwareStructure(defaults, cloneDeep(defaults))
        const init = this.initDirtyTouched(defaults)
        this.dirty = init.dirty
        this.touched = init.touched

        if (restoreDecision.action === 'discard') {
          driver.remove(this.constructor.name)
        }
      }
    } else {
      initialData = defaults
      this.original = restorePropertyAwareStructure(defaults, cloneDeep(defaults))
      const init = this.initDirtyTouched(defaults)
      this.dirty = init.dirty
      this.touched = init.touched
    }

    this.rules = this.defineRules()
    this.validationGroups = this.defineValidationGroups()

    this.buildFieldDependencies()

    this.state = reactive(initialData) as FormBody
    this._model = {} as { [K in keyof FormBody]: WritableComputedRef<FormBody[K]> }

    for (const key in this.state) {
      const value = this.state[key]
      if (value instanceof PropertyAwareArray) {
        this._model[key as keyof FormBody] = computed({
          get: () => this.state[key],
          set: (newVal: PropertyAwareInput<FormBody[typeof key]>) => {
            const next = Array.isArray(newVal) ? Array.from(newVal) : []
            this.replacePropertyAwareArray(key as keyof FormBody, next)
            this.dirty[key as keyof FormBody] = this.computeDirtyState(this.state[key], this.original[key]) as DirtyMap<FormBody>[typeof key]
            this.markFieldUpdated(key as keyof FormBody, driver)
          }
        })
      } else {
        this._model[key as keyof FormBody] = computed({
          get: () => this.state[key],
          set: (value: FormBody[typeof key]) => {
            this.updateField(key as keyof FormBody, value, driver)
          }
        })
      }
    }

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

    this._hasErrors = computed(() => Object.keys(this.flattenErrors()).length > 0)

    if (persist) {
      watch(
        () => this.state,
        () => this.persistState(driver),
        { deep: true, immediate: true }
      )
    }

    this.validate()
  }

  protected defineRules(): ValidationRules<FormBody> {
    return {}
  }

  protected defineValidationGroups(): ValidationGroups<FormBody> {
    return {}
  }

  private clearErrorBag(errorBag: ErrorBag): void {
    for (const key in errorBag) {
      delete errorBag[key]
    }
  }

  private clearSyncErrors(): void {
    this.clearErrorBag(this._errors)
  }

  private clearAsyncErrors(): void {
    this.clearErrorBag(this._asyncErrors)
  }

  private clearErrors(): void {
    this.cancelPendingAsyncValidations()
    this.clearSyncErrors()
    this.clearAsyncErrors()
  }

  private hasAsyncRules(field: keyof FormBody): boolean {
    const fieldConfig = this.rules[field]
    if (!fieldConfig?.rules || fieldConfig.rules.length === 0) {
      return false
    }

    return fieldConfig.rules.some((rule) => rule.validateAsync !== BaseRule.prototype.validateAsync)
  }

  private bumpAsyncValidationToken(field: keyof FormBody): number {
    const fieldKey = String(field)
    const nextToken = (this.asyncValidationTokens[fieldKey] ?? 0) + 1
    this.asyncValidationTokens[fieldKey] = nextToken

    return nextToken
  }

  private cancelPendingAsyncValidations(): void {
    for (const debouncer of this.asyncValidationDebouncers.values()) {
      debouncer.cancel()
    }

    this.pendingAsyncValidationContexts.clear()

    for (const fieldKey of Object.keys(this.asyncValidationTokens)) {
      this.asyncValidationTokens[fieldKey] = (this.asyncValidationTokens[fieldKey] ?? 0) + 1
    }
  }

  private scheduleAsyncValidation(field: keyof FormBody, context: ValidationContext): void {
    if (!this.hasAsyncRules(field)) {
      return
    }

    const token = this.bumpAsyncValidationToken(field)
    const debounceMs = this.rules[field]?.options?.asyncDebounceMs ?? 0

    this.pendingAsyncValidationContexts.set(field, { token, context })

    if (debounceMs <= 0) {
      void this.executeScheduledAsyncValidation(field).catch(() => undefined)
      return
    }

    let debouncer = this.asyncValidationDebouncers.get(field)
    if (debouncer === undefined) {
      debouncer = debounce(() => {
        void this.executeScheduledAsyncValidation(field).catch(() => undefined)
      }, debounceMs)
      this.asyncValidationDebouncers.set(field, debouncer)
    }

    debouncer()
  }

  private async executeScheduledAsyncValidation(field: keyof FormBody): Promise<void> {
    const pending = this.pendingAsyncValidationContexts.get(field)
    if (pending === undefined) {
      return
    }

    await this.runFieldAsyncValidation(
      field,
      {
        ...pending.context,
        skipSyncValidation: true,
        skipAsyncValidation: true
      },
      pending.token
    )
  }

  private flattenErrorValue(value: FieldErrors | undefined, path: string, flattened: Record<string, ErrorMessages>): void {
    if (value === undefined) {
      return
    }

    if (isErrorMessages(value)) {
      if (value.length > 0) {
        flattened[path] = cloneDeep(value)
      }
      return
    }

    if (isErrorArray(value)) {
      value.forEach((item, index) => {
        const itemPath = `${path}.${index}`
        if (isErrorMessages(item)) {
          if (item.length > 0) {
            flattened[itemPath] = cloneDeep(item)
          }
          return
        }

        this.flattenErrorValue(item, itemPath, flattened)
      })
      return
    }

    if (!isErrorObject(value)) {
      return
    }

    const rootErrors = value['']
    if (isErrorMessages(rootErrors) && rootErrors.length > 0) {
      flattened[path] = cloneDeep(rootErrors)
    }

    for (const key of Object.keys(value)) {
      if (key === '') {
        continue
      }

      const nestedPath = path.length > 0 ? `${path}.${key}` : key
      this.flattenErrorValue(value[key], nestedPath, flattened)
    }
  }

  private flattenErrorsFromBag(errorBag: ErrorBag): Record<string, ErrorMessages> {
    const flattened: Record<string, ErrorMessages> = {}

    for (const key of Object.keys(errorBag)) {
      this.flattenErrorValue(errorBag[key], key, flattened)
    }

    return flattened
  }

  private mergeErrorMessages(...messageSets: ErrorMessages[]): ErrorMessages {
    const merged: ErrorMessages = []

    for (const messages of messageSets) {
      for (const message of messages) {
        if (!merged.includes(message)) {
          merged.push(message)
        }
      }
    }

    return merged
  }

  private flattenErrors(): Record<string, ErrorMessages> {
    const flattened = this.flattenErrorsFromBag(this._errors)

    for (const [key, messages] of Object.entries(this.flattenErrorsFromBag(this._asyncErrors))) {
      flattened[key] = this.mergeErrorMessages(flattened[key] ?? [], messages)
    }

    return flattened
  }

  private applyErrors<ErrorInterface extends Record<string, FieldErrors>>(
    errorsData: ErrorInterface,
    useErrorMap: boolean,
    targetBag: ErrorBag = this._errors
  ): void {
    for (const serverKey in errorsData) {
      if (!Object.prototype.hasOwnProperty.call(errorsData, serverKey)) {
        continue
      }

      const errorMessage = errorsData[serverKey]
      if (errorMessage === undefined) {
        continue
      }

      let targetKeys: string[] = [serverKey]

      if (useErrorMap) {
        const mapping = this.errorMap?.[serverKey]
        if (mapping) {
          targetKeys = Array.isArray(mapping) ? mapping : [mapping]
        }
      }

      for (const targetKey of targetKeys) {
        const parts = targetKey.split('.')
        if (parts.length > 1) {
          const topKey = parts[0] ?? ''
          const indexPart = parts[1] ?? ''
          const index = Number.parseInt(indexPart, 10)
          if (!topKey) {
            targetBag[targetKey] = errorMessage
            continue
          }

          if (!Number.isFinite(index)) {
            const current = isErrorObject(targetBag[topKey]) ? targetBag[topKey] : {}
            targetBag[topKey] = current
            this.setNestedError(current, parts.slice(1), errorMessage)
            continue
          }

          const errorSubKey = parts.slice(2).join('.')
          const errors = this.getOrCreateErrorArray(topKey, targetBag)
          const errorObject = this.getOrCreateErrorObject(errors, index)

          if (errorSubKey.length === 0) {
            errorObject[''] = errorMessage
          } else {
            this.setNestedError(errorObject, errorSubKey.split('.'), errorMessage)
          }
        } else {
          targetBag[targetKey] = errorMessage
        }
      }
    }
  }

  private getValidationGroupPaths(group: string): string[] {
    const paths = this.validationGroups[group]

    if (!paths || paths.length === 0) {
      return []
    }

    return [...paths]
  }

  private matchesValidationGroupPath(errorKey: string, groupPath: string): boolean {
    return errorKey === groupPath || errorKey.startsWith(`${groupPath}.`)
  }

  private errorKeyBelongsToGroup(errorKey: string, group: string): boolean {
    return this.getValidationGroupPaths(group).some((groupPath) => this.matchesValidationGroupPath(errorKey, groupPath))
  }

  private getValidationGroupFields(group: string): Array<keyof FormBody> {
    const fields: Array<keyof FormBody> = []

    for (const path of this.getValidationGroupPaths(group)) {
      const [topLevelField] = path.split('.')
      if (!topLevelField || !(topLevelField in this.state)) {
        continue
      }

      const typedField = topLevelField as keyof FormBody
      if (!fields.includes(typedField)) {
        fields.push(typedField)
      }
    }

    return fields
  }

  private clearGroupErrors(group: string): void {
    const groupPaths = this.getValidationGroupPaths(group)
    if (groupPaths.length === 0) {
      return
    }

    const preservedErrors: Record<string, ErrorMessages> = {}
    for (const [errorKey, errorValue] of Object.entries(this.flattenErrors())) {
      if (!this.errorKeyBelongsToGroup(errorKey, group)) {
        preservedErrors[errorKey] = cloneDeep(errorValue)
      }
    }

    this.clearErrors()
    this.applyErrors(preservedErrors, false)
  }

  private collectSiblingNestedErrors(field: keyof FormBody, path: string[]): Record<string, ErrorMessages> {
    if (path.length === 0) {
      return {}
    }

    const fieldKey = String(field)
    const clearedPath = `${fieldKey}.${path.join('.')}`
    const preservedErrors: Record<string, ErrorMessages> = {}

    for (const [errorKey, errorValue] of Object.entries(this.flattenErrors())) {
      if (!this.matchesValidationGroupPath(errorKey, fieldKey)) {
        continue
      }

      if (errorKey === clearedPath || errorKey.startsWith(`${clearedPath}.`)) {
        continue
      }

      preservedErrors[errorKey] = cloneDeep(errorValue)
    }

    return preservedErrors
  }

  private validateFieldPreservingNestedErrors(field: keyof FormBody, path: string[]): void {
    const preservedErrors = this.collectSiblingNestedErrors(field, path)
    this.validateField(field)

    if (Object.keys(preservedErrors).length > 0) {
      this.applyErrors(preservedErrors, false)
    }
  }

  private clearErrorBagPaths(errorBag: ErrorBag, paths: string[]): void {
    const preservedErrors: Record<string, ErrorMessages> = {}

    for (const [errorKey, errorValue] of Object.entries(this.flattenErrorsFromBag(errorBag))) {
      if (!paths.some((path) => this.matchesValidationGroupPath(errorKey, path))) {
        preservedErrors[errorKey] = cloneDeep(errorValue)
      }
    }

    this.clearErrorBag(errorBag)
    this.applyErrors(preservedErrors, false, errorBag)
  }

  private getOrCreateErrorArray(key: string, errorBag: ErrorBag = this._errors): ErrorArray {
    const existing = errorBag[key]
    if (isErrorArray(existing)) {
      return existing
    }

    const next: ErrorArray = []
    errorBag[key] = next
    return next
  }

  private getOrCreateErrorObject(errors: ErrorArray, index: number): ErrorObject {
    const existing = errors[index]
    if (isErrorObject(existing)) {
      return existing
    }

    const next: ErrorObject = {}
    errors[index] = next
    return next
  }

  private getFieldErrors(field: string): ErrorMessages {
    const syncErrors = this._errors[field]
    const asyncErrors = this._asyncErrors[field]

    return this.mergeErrorMessages(isErrorMessages(syncErrors) ? syncErrors : [], isErrorMessages(asyncErrors) ? asyncErrors : [])
  }

  private getOrCreateFieldErrors(field: string): ErrorMessages {
    const existing = this._errors[field]
    if (isErrorMessages(existing)) {
      return existing
    }

    const next: ErrorMessages = []
    this._errors[field] = next
    return next
  }

  private getArrayItemErrors(field: string, index: number): ErrorObject | undefined {
    const errors = this._errors[field]
    if (!isErrorArray(errors)) {
      return undefined
    }
    const item = errors[index]
    return isErrorObject(item) ? item : undefined
  }

  private getArrayItemFieldErrors(field: string, index: number, innerKey: string): ErrorMessages {
    return this.mergeErrorMessages(
      this.getNestedErrorMessagesFromValue(this.getArrayItemErrors(field, index), innerKey.split('.')),
      this.getNestedErrorMessagesFromValue(this.getArrayItemErrorsFromBag(this._asyncErrors, field, index), innerKey.split('.'))
    )
  }

  private getArrayItemErrorMessages(field: string, index: number): ErrorMessages {
    return this.mergeErrorMessages(
      this.getArrayItemErrorMessagesFromBag(this._errors, field, index),
      this.getArrayItemErrorMessagesFromBag(this._asyncErrors, field, index)
    )
  }

  private getObjectFieldErrors(field: string, path: string[]): ErrorMessages {
    return this.mergeErrorMessages(
      this.getNestedErrorMessagesFromValue(this._errors[field], path),
      this.getNestedErrorMessagesFromValue(this._asyncErrors[field], path)
    )
  }

  private getArrayItemErrorsFromBag(errorBag: ErrorBag, field: string, index: number): ErrorObject | undefined {
    const errors = errorBag[field]
    if (!isErrorArray(errors)) {
      return undefined
    }

    const item = errors[index]
    return isErrorObject(item) ? item : undefined
  }

  private getArrayItemErrorMessagesFromBag(errorBag: ErrorBag, field: string, index: number): ErrorMessages {
    const errors = errorBag[field]
    if (!Array.isArray(errors)) {
      return []
    }

    const item = errors[index]
    if (isErrorMessages(item)) {
      return item
    }

    if (isErrorObject(item)) {
      const nestedErrors = item['']
      return isErrorMessages(nestedErrors) ? nestedErrors : []
    }

    return []
  }

  private setArrayDirty(field: keyof FormBody, index: number, value: DirtyState): void {
    const dirtyState = this.dirty[field]
    if (Array.isArray(dirtyState)) {
      dirtyState[index] = this.normalizeItemDirtyState(value)
    }
  }

  /**
   * Collapse nested array dirty states into a single boolean/object for array entries.
   */
  private normalizeItemDirtyState(value: DirtyState): boolean | DirtyObject {
    if (!Array.isArray(value)) {
      return value
    }

    return value.some((entry) => {
      if (typeof entry === 'boolean') {
        return entry
      }
      if (isRecord(entry)) {
        return Object.values(entry).some((item) => item === true)
      }
      return false
    })
  }

  private getArrayItemDirty(field: keyof FormBody, index: number, innerKey: string): boolean {
    const dirtyState = this.dirty[field]
    if (!Array.isArray(dirtyState)) {
      return false
    }

    const entry = dirtyState[index]
    return this.getNestedDirtyValue(entry as DirtyState | undefined, innerKey.split('.'))
  }

  private getArrayItemDirtyValue(field: keyof FormBody, index: number): boolean {
    const dirtyState = this.dirty[field]
    if (!Array.isArray(dirtyState)) {
      return false
    }

    const entry = dirtyState[index]
    return typeof entry === 'boolean' ? entry : false
  }

  private getNestedErrorMessagesFromValue(value: unknown, path: string[]): ErrorMessages {
    if (path.length === 0) {
      if (isErrorMessages(value)) {
        return value
      }

      if (isErrorObject(value)) {
        const nestedErrors = value['']
        return isErrorMessages(nestedErrors) ? nestedErrors : []
      }

      return []
    }

    if (!isErrorObject(value)) {
      return []
    }

    const [segment, ...rest] = path
    if (segment === undefined) {
      return []
    }

    return this.getNestedErrorMessagesFromValue(value[segment], rest)
  }

  private setNestedError(target: ErrorObject, path: string[], errorMessage: FieldErrors): void {
    if (path.length === 0) {
      target[''] = errorMessage
      return
    }

    const [segment, ...rest] = path
    if (segment === undefined) {
      return
    }

    if (rest.length === 0) {
      target[segment] = errorMessage
      return
    }

    const next = isErrorObject(target[segment]) ? target[segment] : {}
    target[segment] = next
    this.setNestedError(next, rest, errorMessage)
  }

  private getNestedDirtyValue(value: DirtyState | undefined, path: string[]): boolean {
    if (path.length === 0) {
      if (typeof value === 'boolean') {
        return value
      }

      if (Array.isArray(value)) {
        return value.some((entry) => this.getNestedDirtyValue(entry, []))
      }

      if (isRecord(value)) {
        return Object.values(value).some((item) => this.getNestedDirtyValue(item as DirtyState, []))
      }

      return false
    }

    if (!isRecord(value)) {
      return false
    }

    const [segment, ...rest] = path
    if (segment === undefined) {
      return false
    }

    return this.getNestedDirtyValue(value[segment] as DirtyState | undefined, rest)
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

  private getArrayItemValueByPath<K extends keyof FormBody>(field: K, item: ArrayItem<FormBody[K]>, path: string[]): unknown {
    const index = this.resolveArrayItemIndex(field, item)
    if (index < 0) {
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

  private setArrayItemValueByPath<K extends keyof FormBody>(field: K, item: ArrayItem<FormBody[K]>, path: string[], value: unknown): void {
    const index = this.resolveArrayItemIndex(field, item)
    if (index < 0) {
      return
    }

    if (path.length === 0) {
      ;(this.state[field] as PropertyAwareArray<ArrayItem<FormBody[K]>>)[index] = value as ArrayItem<FormBody[K]>
      const updatedElement = (this.state[field] as PropertyAwareArray<ArrayItem<FormBody[K]>>)[index]
      const originalElement = (this.original[field] as PropertyAwareArray<ArrayItem<FormBody[K]>>)[index]
      this.setArrayDirty(field, index, this.computeDirtyState(updatedElement, originalElement))
      this.touched[field] = true
      this.validateField(field)
      this.validateDependentFields(field)
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

    const updatedElement = (this.state[field] as PropertyAwareArray<ArrayItem<FormBody[K]>>)[index]
    const originalElement = (this.original[field] as PropertyAwareArray<ArrayItem<FormBody[K]>>)[index]
    this.setArrayDirty(field, index, this.computeDirtyState(updatedElement, originalElement))
    this.touched[field] = true
    this.validateFieldPreservingNestedErrors(field, [String(index), ...path])
    this.validateDependentFields(field)
  }

  private createObjectWrapperFromShape<K extends keyof FormBody>(
    field: K,
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
          field,
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

  private getOrCreateArrayItemWrapper<K extends keyof FormBody>(field: K, item: ArrayItem<FormBody[K]>): Record<string, unknown> {
    let fieldCache = this.arrayItemWrapperCache.get(field)
    if (!fieldCache) {
      fieldCache = new WeakMap<object, Record<string, unknown>>()
      this.arrayItemWrapperCache.set(field, fieldCache)
    }

    const existing = fieldCache.get(item as object)
    if (existing) {
      return existing
    }

    const wrapper: Record<string, unknown> = {}

    if (isRecord(item)) {
      for (const innerKey of Object.keys(item)) {
        const child = item[innerKey]

        if (isPropertyAwareObject(child)) {
          wrapper[innerKey] = this.createObjectWrapperFromShape(
            field,
            child,
            (path) => this.getArrayItemValueByPath(field, item, [innerKey, ...path]),
            (path, value) => this.setArrayItemValueByPath(field, item, [innerKey, ...path], value),
            (path) => {
              const index = this.resolveArrayItemIndex(field, item)
              return index < 0 ? [] : this.getArrayItemFieldErrors(String(field), index, [innerKey, ...path].join('.'))
            },
            (path) => {
              const index = this.resolveArrayItemIndex(field, item)
              return index < 0
                ? false
                : this.getNestedDirtyValue((this.dirty[field] as DirtyArray | undefined)?.[index] as DirtyState | undefined, [innerKey, ...path])
            },
            () => this.touched[field] || false
          )
          continue
        }

        wrapper[innerKey] = this.createFieldProperty(
          () => this.getArrayItemValueByPath(field, item, [innerKey]) as typeof child,
          (newValue) => this.setArrayItemValueByPath(field, item, [innerKey], newValue),
          () => {
            const index = this.resolveArrayItemIndex(field, item)
            return index < 0 ? [] : this.getArrayItemFieldErrors(String(field), index, innerKey)
          },
          () => {
            const index = this.resolveArrayItemIndex(field, item)
            return index < 0 ? false : this.getArrayItemDirty(field, index, innerKey)
          },
          () => this.touched[field] || false
        )
      }
    } else {
      wrapper['value'] = this.createFieldProperty(
        () => this.getArrayItemValueByPath(field, item, []) as ArrayItem<FormBody[K]>,
        (newValue) => this.setArrayItemValueByPath(field, item, [], newValue),
        () => {
          const index = this.resolveArrayItemIndex(field, item)
          return index < 0 ? [] : this.getArrayItemErrorMessages(String(field), index)
        },
        () => {
          const index = this.resolveArrayItemIndex(field, item)
          return index < 0 ? false : this.getArrayItemDirtyValue(field, index)
        },
        () => this.touched[field] || false
      )
    }

    fieldCache.set(item as object, wrapper)
    return wrapper
  }

  private getOrCreateArrayWrappers<K extends keyof FormBody>(field: K, value: PropertyAwareArray<ArrayItem<FormBody[K]>>): Array<unknown> {
    let wrappers = this.arrayWrapperCache.get(field)
    if (!wrappers) {
      wrappers = []
      this.arrayWrapperCache.set(field, wrappers)
    }

    wrappers.length = 0
    value.forEach((item) => {
      wrappers!.push(this.getOrCreateArrayItemWrapper(field, item))
    })

    return wrappers
  }

  /**
   * Map server-side errors (including dot-notation paths) into the form error bag.
   */
  public fillErrors<ErrorInterface extends Record<string, FieldErrors>>(errorsData: ErrorInterface): void {
    this.clearErrors()
    this.applyErrors(errorsData, true)
  }

  /**
   * Mark a field as touched, which indicates user interaction
   * Optionally triggers validation
   * @param field The field to mark as touched
   */
  public touch(field: keyof FormBody): void {
    this.touched[field] = true

    const fieldConfig = this.rules[field]
    if (fieldConfig) {
      const mode = fieldConfig.options?.mode ?? ValidationMode.DEFAULT

      if (mode & ValidationMode.ON_TOUCH) {
        this.validateField(field, {
          isSubmitting: false,
          isDependentChange: false
        })
      }
    }

    if (this.options?.persist !== false) {
      this.persistState()
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

  protected validateField(field: keyof FormBody, context: AsyncValidationContext = {}): void {
    const emptyErrors: ErrorMessages = []
    const errorKey = String(field)
    this._errors[errorKey] = emptyErrors

    const value = this.state[field]

    const fieldConfig = this.rules[field]
    if (!fieldConfig?.rules || fieldConfig.rules.length === 0) {
      return // No rules to validate
    }

    const mode = fieldConfig.options?.mode ?? ValidationMode.DEFAULT

    const isDirty = context.isDirty !== undefined ? context.isDirty : this.isDirty(field)
    const isTouched = context.isTouched !== undefined ? context.isTouched : this.isTouched(field)

    const shouldValidate =
      (context.isSubmitting && mode & ValidationMode.ON_SUBMIT) ||
      (isDirty && mode & ValidationMode.ON_DIRTY) ||
      (isTouched && mode & ValidationMode.ON_TOUCH) ||
      mode & ValidationMode.INSTANTLY ||
      (context.isDependentChange && mode & ValidationMode.ON_DEPENDENT_CHANGE)

    if (shouldValidate) {
      for (const rule of fieldConfig.rules) {
        const isValid = rule.validate(value, this.state)
        if (!isValid) {
          this.getOrCreateFieldErrors(errorKey).push(rule.getMessage())
        }
      }

      if (!context.skipAsyncValidation) {
        this.scheduleAsyncValidation(field, context)
      }
    }
  }

  public validate(isSubmitting: boolean = false, options: { skipAsyncValidation?: boolean } = {}): boolean {
    let isValid = true

    this.clearSyncErrors()

    for (const field in this.rules) {
      if (Object.prototype.hasOwnProperty.call(this.rules, field)) {
        this.validateField(field as keyof FormBody, {
          isSubmitting,
          isDependentChange: false,
          isTouched: this.isTouched(field as keyof FormBody),
          skipAsyncValidation: options.skipAsyncValidation ?? false
        })

        const fieldErrors = this._errors[String(field)]
        if (isErrorMessages(fieldErrors) && fieldErrors.length > 0) {
          isValid = false
        }
      }
    }

    return isValid
  }

  public validateGroup(group: string, isSubmitting: boolean = false, options: { skipAsyncValidation?: boolean } = {}): boolean {
    const fields = this.getValidationGroupFields(group)
    if (fields.length === 0) {
      return true
    }

    this.clearGroupErrors(group)

    for (const field of fields) {
      this.validateField(field, {
        isSubmitting,
        isDependentChange: false,
        isTouched: this.isTouched(field),
        skipAsyncValidation: options.skipAsyncValidation ?? false
      })
    }

    return !this.hasErrorsInGroup(group)
  }

  private async runFieldAsyncValidation(field: keyof FormBody, context: AsyncValidationContext = {}, expectedToken?: number): Promise<boolean> {
    if (!context.skipSyncValidation) {
      this.validateField(field, {
        ...context,
        skipAsyncValidation: true
      })
    }

    const fieldConfig = this.rules[field]
    if (!fieldConfig?.rules || fieldConfig.rules.length === 0) {
      return !Object.keys(this.flattenErrors()).some((errorKey) => this.matchesValidationGroupPath(errorKey, String(field)))
    }

    const asyncPaths = fieldConfig.rules.flatMap((rule) => rule.getAsyncValidationPaths(field, this.state))
    const payload = this.buildPayload() as Record<string, unknown>
    const nextAsyncErrors: ErrorBag = {}

    for (const rule of fieldConfig.rules) {
      const errors = await rule.validateAsync(this.state[field], this.state, {
        field: String(field),
        payload,
        isSubmitting: context.isSubmitting ?? false
      })

      if (errors && Object.keys(errors).length > 0) {
        this.applyErrors(errors as Record<string, FieldErrors>, false, nextAsyncErrors)
      }
    }

    if (expectedToken !== undefined && this.asyncValidationTokens[String(field)] !== expectedToken) {
      return !Object.keys(this.flattenErrors()).some((errorKey) => this.matchesValidationGroupPath(errorKey, String(field)))
    }

    this.clearErrorBagPaths(this._asyncErrors, asyncPaths)
    for (const [key, messages] of Object.entries(this.flattenErrorsFromBag(nextAsyncErrors))) {
      this.applyErrors({ [key]: messages }, false, this._asyncErrors)
    }

    return !Object.keys(this.flattenErrors()).some((errorKey) => this.matchesValidationGroupPath(errorKey, String(field)))
  }

  public async validateFieldAsync(field: keyof FormBody, context: AsyncValidationContext = {}): Promise<boolean> {
    const token = this.bumpAsyncValidationToken(field)

    return await this.runFieldAsyncValidation(
      field,
      {
        ...context,
        skipAsyncValidation: true
      },
      token
    )
  }

  public async validateAsync(isSubmitting: boolean = false): Promise<boolean> {
    const isSyncValid = this.validate(isSubmitting, { skipAsyncValidation: true })

    for (const field in this.rules) {
      if (Object.prototype.hasOwnProperty.call(this.rules, field)) {
        await this.validateFieldAsync(field as keyof FormBody, {
          isSubmitting,
          isTouched: this.isTouched(field as keyof FormBody),
          skipSyncValidation: true
        })
      }
    }

    return isSyncValid && !this.hasErrors()
  }

  public async validateGroupAsync(group: string, isSubmitting: boolean = false): Promise<boolean> {
    const fields = this.getValidationGroupFields(group)
    if (fields.length === 0) {
      return true
    }

    const isSyncValid = this.validateGroup(group, isSubmitting, { skipAsyncValidation: true })

    for (const field of fields) {
      await this.validateFieldAsync(field, {
        isSubmitting,
        isTouched: this.isTouched(field),
        skipSyncValidation: true
      })
    }

    return isSyncValid && !this.hasErrorsInGroup(group)
  }

  public touchGroup(group: string): void {
    for (const field of this.getValidationGroupFields(group)) {
      this.touch(field)
    }
  }

  public fillState(data: Partial<FormBody>): void {
    const driver = this.getPersistenceDriver(this.options?.persistSuffix)
    for (const key of Object.keys(data) as Array<keyof FormBody>) {
      if (!Object.prototype.hasOwnProperty.call(data, key) || !(key in this.state)) {
        continue
      }

      const currentVal = this.state[key]
      const newVal = data[key] as FormBody[typeof key] | undefined

      if (currentVal instanceof PropertyAwareArray) {
        const values = newVal instanceof PropertyAwareArray || Array.isArray(newVal) ? Array.from(newVal) : []
        this.replacePropertyAwareArray(key, values)

        this.dirty[key] = this.computeDirtyState(this.state[key], this.original[key]) as DirtyMap<FormBody>[typeof key]
        this.touched[key] = true
        continue
      }

      if (isPropertyAwareObject(currentVal)) {
        this.state[key] = restorePropertyAwareStructure(currentVal, newVal) as FormBody[typeof key]
        this.dirty[key] = this.computeDirtyState(this.state[key], this.original[key])
        this.touched[key] = true
        continue
      }

      if (Array.isArray(newVal) && Array.isArray(currentVal)) {
        const merged = newVal.length === currentVal.length ? deepMergeArrays(currentVal, newVal) : newVal
        this.state[key] = merged as FormBody[typeof key]
        this.dirty[key] = this.computeDirtyState(this.state[key], this.original[key])
        this.touched[key] = true
        continue
      }

      if (isRecord(newVal) && isRecord(currentVal)) {
        this.state[key] = shallowMerge({ ...currentVal }, newVal) as FormBody[typeof key]
        this.dirty[key] = this.computeDirtyState(this.state[key], this.original[key])
        this.touched[key] = true
        continue
      }

      this.state[key] = newVal as FormBody[typeof key]
      this.dirty[key] = this.computeDirtyState(this.state[key], this.original[key])
      this.touched[key] = true
    }
    this.persistState(driver)

    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key) && key in this.state) {
        this.validateField(key as keyof FormBody)
        this.validateDependentFields(key as keyof FormBody)
      }
    }
  }

  private getValueGetter(name: string): ((value: unknown) => unknown) | undefined {
    const candidate = (this as Record<string, unknown>)[name]
    if (typeof candidate !== 'function') {
      return undefined
    }
    return (candidate as (value: unknown) => unknown).bind(this)
  }

  private getNoArgGetter(name: string): (() => unknown) | undefined {
    const candidate = (this as Record<string, unknown>)[name]
    if (typeof candidate !== 'function') {
      return undefined
    }
    return (candidate as () => unknown).bind(this)
  }

  private transformValue(value: unknown, parentKey?: string): unknown {
    if (value instanceof Date) {
      return value
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      return value
    }
    if (value instanceof PropertyAwareArray) {
      return [...value].map((item) => this.transformValue(item, parentKey))
    }
    if (isPropertyAwareObject(value)) {
      const result: Record<string, unknown> = {}
      const valueRecord = value as Record<string, unknown>
      for (const prop in valueRecord) {
        const transformed = this.transformValue(valueRecord[prop], parentKey)
        if (transformed !== undefined) {
          result[prop] = transformed
        }
      }
      return result
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.transformValue(item, parentKey))
    } else if (isRecord(value)) {
      const result: Record<string, unknown> = {}
      for (const prop in value) {
        if (parentKey) {
          const compositeMethod = 'get' + upperFirst(parentKey) + upperFirst(camelCase(prop))
          const getter = this.getValueGetter(compositeMethod)
          if (getter) {
            const transformed = getter(value[prop])
            if (transformed !== undefined) {
              result[prop] = transformed
            }
            continue
          }
        }
        const transformed = this.transformValue(value[prop], parentKey)
        if (transformed !== undefined) {
          result[prop] = transformed
        }
      }
      return result
    }
    return value
  }

  /**
   * Build the request payload, applying field/composite/appended getters when present.
   */
  public buildPayload(): RequestBody {
    const payload = {} as RequestBody
    for (const key of Object.keys(this.state) as Array<FormKey<FormBody> & RequestKey<RequestBody>>) {
      if (this.ignore.includes(key)) {
        continue
      }

      const value = this.state[key]

      const getterName = 'get' + upperFirst(camelCase(key))
      const typedKey = key
      const getter = this.getValueGetter(getterName)
      if (getter) {
        const transformed = getter(value)
        if (transformed !== undefined) {
          payload[typedKey] = transformed as RequestBody[typeof typedKey]
        }
      } else {
        const transformed = this.transformValue(value, key)
        if (transformed !== undefined) {
          payload[typedKey] = transformed as RequestBody[typeof typedKey]
        }
      }
    }

    for (const fieldName of this.append) {
      if (Array.isArray(this.ignore) && this.ignore.includes(fieldName)) {
        console.warn(`Appended field '${fieldName}' is also in ignore list in ${this.constructor.name}. It will be skipped.`)
        continue
      }

      const getterName = 'get' + upperFirst(camelCase(fieldName))
      const getter = this.getNoArgGetter(getterName)
      if (getter) {
        const transformed = getter()
        if (transformed !== undefined) {
          payload[fieldName as keyof RequestBody] = transformed as RequestBody[keyof RequestBody]
        }
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
        const originalValue = this.original[key] as PropertyAwareArray
        const values = [...originalValue].map((item) => cloneDeep(item))
        const typedKey = key as keyof FormBody
        this.replacePropertyAwareArray(typedKey, values as Array<ArrayItem<FormBody[typeof typedKey]>>)
        this.dirty[typedKey] = values.map(() => false)
        this.touched[typedKey] = false
      } else if (isPropertyAwareObject(this.state[key])) {
        this.state[key] = restorePropertyAwareStructure(this.original[key], cloneDeep(this.original[key]))
        this.dirty[key as keyof FormBody] = false
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
    this.clearErrors()
    this.persistState(driver)

    this.validate()
  }

  protected addToArrayProperty<K extends keyof FormBody>(property: K, newElement: ArrayItem<FormBody[K]>): void {
    const driver = this.getPersistenceDriver(this.options?.persistSuffix)
    const arr = this.state[property]
    if (arr instanceof PropertyAwareArray) {
      arr.push(newElement)
      this.touched[property] = true
      this.persistState(driver)

      return
    }

    if (!Array.isArray(arr)) {
      throw new Error(`Property "${String(property)}" is not an array.`)
    }

    arr.push(newElement)
    this.dirty[property] = this.computeDirtyState(arr, this.original[property])
    this.touched[property] = true
    this.persistState(driver)

    this.validateField(property)
    this.validateDependentFields(property)
  }

  protected removeArrayItem<K extends keyof FormBody>(arrayIndex: K, filter: (item: ArrayItem<FormBody[K]>) => boolean): void {
    const current = this.state[arrayIndex]
    if (current instanceof PropertyAwareArray) {
      const filtered = [...current].filter(filter)
      current.length = 0
      filtered.forEach((item) => current.push(item))
    } else if (Array.isArray(current)) {
      this.state[arrayIndex] = current.filter(filter) as FormBody[K]
    }

    this.touched[arrayIndex] = true

    this.validateField(arrayIndex)
    this.validateDependentFields(arrayIndex)
  }

  protected resetArrayCounter(arrayIndex: keyof FormBody, counterIndex: string): void {
    let count = 1
    const current = this.state[arrayIndex]
    if (current instanceof PropertyAwareArray) {
      ;[...current].forEach((item): void => {
        if (isRecord(item)) {
          item[counterIndex] = count
          count++
        }
      })
    } else if (Array.isArray(current)) {
      current.forEach((item): void => {
        if (isRecord(item)) {
          item[counterIndex] = count
          count++
        }
      })
    }

    this.touched[arrayIndex as keyof FormBody] = true
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
          key,
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
            this.dirty[key] = this.computeDirtyState(this.state[key], this.original[key])
            this.touched[key] = true
            this.validateFieldPreservingNestedErrors(key, path)
            this.validateDependentFields(key)
          },
          (path) => this.getObjectFieldErrors(String(key), path),
          (path) => this.getNestedDirtyValue(this.dirty[key], path),
          () => this.touched[key] || false
        ) as FormProperties<FormBody>[typeof key]
        continue
      }

      props[key] = this.createFieldProperty(
        () => this._model[key].value,
        (newValue) => {
          this._model[key].value = newValue
        },
        () => this.getFieldErrors(key),
        () => (this.dirty[key] as boolean) || false,
        () => this.touched[key] || false
      ) as FormProperties<FormBody>[typeof key]
    }
    return props as FormProperties<FormBody>
  }

  /**
   * Checks if the form or a specific field is dirty
   * @param field Optional field name to check, if not provided checks the entire form
   * @returns boolean indicating if the form or specified field is dirty
   */
  public isDirty(field?: keyof FormBody): boolean {
    if (field !== undefined) {
      return this.getNestedDirtyValue(this.dirty[field], [])
    }

    for (const key in this.dirty) {
      if (this.getNestedDirtyValue(this.dirty[key as keyof FormBody], [])) {
        return true
      }
    }

    return false
  }

  /**
   * Returns whether the form has validation errors
   * @returns boolean indicating if the form has errors
   */
  public hasErrors(): boolean {
    return this._hasErrors.value
  }

  public getErrors(): Record<string, ErrorMessages> {
    return this.flattenErrors()
  }

  public hasErrorsInGroup(group: string): boolean {
    return Object.keys(this.flattenErrors()).some((errorKey) => this.errorKeyBelongsToGroup(errorKey, group))
  }

  public getErrorsInGroup(group: string): Record<string, ErrorMessages> {
    const groupErrors: Record<string, ErrorMessages> = {}

    for (const [errorKey, errorMessages] of Object.entries(this.flattenErrors())) {
      if (this.errorKeyBelongsToGroup(errorKey, group)) {
        groupErrors[errorKey] = cloneDeep(errorMessages)
      }
    }

    return groupErrors
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

    if (currentVal instanceof PropertyAwareArray) {
      const arr = this.state[key] as PropertyAwareArray
      const originalArr = this.original[key] as PropertyAwareArray

      arr.length = 0
      originalArr.length = 0

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

      this.dirty[key] = Array.from(arr).map(() => false)
      this.touched[key] = true
    } else if (Array.isArray(currentVal)) {
      this.state[key] = cloneDeep(value)
      this.original[key] = cloneDeep(value)
      this.dirty[key] = false
      this.touched[key] = true
    } else if (typeof currentVal === 'object' && currentVal !== null) {
      this.state[key] = cloneDeep(value)
      this.original[key] = cloneDeep(value)
      this.dirty[key] = false
      this.touched[key] = true
    } else {
      this.state[key] = value
      this.original[key] = value
      this.dirty[key] = false
      this.touched[key] = true
    }

    if (this.options?.persist !== false) {
      this.persistState(driver)
    }

    this.validateField(key)
    this.validateDependentFields(key)
  }
}
