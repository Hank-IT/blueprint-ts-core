import { reactive, toRaw, watch } from 'vue'
import { isEqual } from 'lodash-es'
import { NonPersistentDriver } from '../../persistenceDrivers/NonPersistentDriver'
import type { PersistenceDriver } from '../../persistenceDrivers/types/PersistenceDriver'
import { PropertyAwareArray } from './PropertyAwareArray'
import { FormBindings } from './internal/FormBindings'
import { FormErrors } from './internal/FormErrors'
import { FormValidation } from './internal/FormValidation'
import { buildFormPayload } from './internal/formPayload'
import {
  cloneFormValue,
  deepMergeArrays,
  isPropertyAwareObject,
  isRecord,
  replacePropertyAwareArray,
  restorePropertyAwareStructure,
  shallowMerge
} from './internal/formValues'
import type { ArrayItem, AsyncValidationContext, BaseFormOptions, ErrorMessages, FieldErrors, FormProperties } from './internal/types'
import { FormPersistence } from './persistence/FormPersistence'
import { StrictPersistenceRestorePolicy } from './persistence/StrictPersistenceRestorePolicy'
import type { PersistenceDebugEvent, PersistenceRestorePolicy } from './persistence/types'
import { ValidationMode, type ValidationGroups, type ValidationRules } from './validation'

export { propertyAwareToRaw } from './internal/formValues'
export type { BaseFormOptions } from './internal/types'

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
  private readonly touched: Record<keyof FormBody, boolean>
  private readonly original: FormBody
  protected append: string[] = []
  protected ignore: string[] = []
  protected errorMap: { [serverKey: string]: string | string[] } = {}
  protected rules: ValidationRules<FormBody> = {}
  protected validationGroups: ValidationGroups<FormBody> = {}

  private readonly formErrors = new FormErrors()
  private readonly formValidation = new FormValidation<FormBody>(
    {
      state: () => this.state,
      rules: () => this.rules,
      groups: () => this.validationGroups,
      isDirty: (field) => this.isDirty(field),
      isTouched: (field) => this.isTouched(field),
      validateField: (field, context) => this.validateField(field, context),
      buildPayload: () => this.buildPayload()
    },
    this.formErrors
  )
  private readonly formBindings: FormBindings<FormBody>
  private readonly formPersistence: FormPersistence<FormBody>

  protected constructor(
    defaults: FormBody,
    protected options?: BaseFormOptions
  ) {
    this.formPersistence = new FormPersistence<FormBody>({
      formName: this.constructor.name,
      options: () => this.options,
      driver: (suffix) => this.getPersistenceDriver(suffix),
      restorePolicy: () => this.getPersistenceRestorePolicy(),
      log: (event) => this.logPersistenceDebug(event)
    })
    const driver = this.formPersistence.getActiveDriver()
    const initial = this.formPersistence.restore(defaults, driver)
    this.touched = reactive(initial.touched) as Record<keyof FormBody, boolean>
    // Dirty indicators also depend on changes to the saved baseline.
    this.original = reactive(initial.original) as FormBody
    this.rules = this.defineRules()
    this.validationGroups = this.defineValidationGroups()
    this.formValidation.buildFieldDependencies()

    this.state = reactive(initial.state) as FormBody
    this.formBindings = new FormBindings(this.state, this.original, this.touched, this.formErrors, {
      fieldChanged: (field) => this.markFieldUpdated(field, driver),
      nestedFieldChanged: (field, path) => {
        this.touched[field] = true
        this.validateFieldPreservingNestedErrors(field, path)
        this.formValidation.validateDependentFields(field)
      },
      isDirty: (field) => this.isDirty(field)
    })

    for (const key in this.state) {
      const value = this.state[key]
      if (Array.isArray(value) && !(value instanceof PropertyAwareArray)) {
        watch(
          () => this.state[key],
          () => {
            this.touched[key] = true
          },
          { deep: true }
        )
      }
    }

    if (options?.persist === true && driver) {
      watch(
        () => this.state,
        () => this.persistState(driver),
        { deep: true, immediate: true }
      )
    }

    this.validate()
  }

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

    const context = event.persistSuffix ? `${event.formName}, ${event.persistSuffix}` : event.formName
    const details = event.details ? ` ${JSON.stringify(event.details)}` : ''

    console.debug(`[BaseForm persistence] ${event.persistKey} (${context}): ${event.action} (${event.reason})${details}`)
  }

  protected defineRules(): ValidationRules<FormBody> {
    return {}
  }

  protected defineValidationGroups(): ValidationGroups<FormBody> {
    return {}
  }

  private persistState(driver?: PersistenceDriver): void {
    this.formPersistence.persist(this.state, this.original, this.touched, driver)
  }

  private markFieldUpdated(key: keyof FormBody, driver?: PersistenceDriver): void {
    this.touched[key] = true
    this.validateField(key)
    this.formValidation.validateDependentFields(key)
    this.persistState(driver)
  }

  private clearErrors(): void {
    this.formValidation.cancelPendingAsyncValidations()
    this.formErrors.clearSyncErrors()
    this.formErrors.clearAsyncErrors()
  }

  private clearGroupErrors(group: string): void {
    const groupPaths = this.formValidation.getValidationGroupPaths(group)
    if (groupPaths.length === 0) {
      return
    }

    const preservedErrors: Record<string, ErrorMessages> = {}
    for (const [errorKey, errorValue] of Object.entries(this.formErrors.flattenErrors())) {
      if (!this.formValidation.errorKeyBelongsToGroup(errorKey, group)) {
        preservedErrors[errorKey] = cloneFormValue(errorValue)
      }
    }

    this.clearErrors()
    this.formErrors.applyErrors(preservedErrors)
  }

  private validateFieldPreservingNestedErrors(field: keyof FormBody, path: string[]): void {
    const preservedErrors = this.formErrors.collectSiblingNestedErrors(String(field), path)
    this.validateField(field)

    if (Object.keys(preservedErrors).length > 0) {
      this.formErrors.applyErrors(preservedErrors)
    }
  }

  /**
   * Map server-side errors (including dot-notation paths) into the form error bag.
   */
  public fillErrors<ErrorInterface extends Record<string, FieldErrors>>(errorsData: ErrorInterface): void {
    this.clearErrors()
    this.formErrors.applyErrors(errorsData, this.errorMap)
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

    if (this.options?.persist === true) {
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
    this.formValidation.validateField(field, context)
  }

  public validate(isSubmitting: boolean = false, options: { skipAsyncValidation?: boolean } = {}): boolean {
    let isValid = true

    this.formErrors.clearSyncErrors()

    for (const field in this.rules) {
      if (Object.prototype.hasOwnProperty.call(this.rules, field)) {
        this.validateField(field as keyof FormBody, {
          isSubmitting,
          isDependentChange: false,
          isTouched: this.isTouched(field as keyof FormBody),
          skipAsyncValidation: options.skipAsyncValidation ?? false
        })

        if (this.formErrors.hasSyncErrors(String(field))) {
          isValid = false
        }
      }
    }

    return isValid
  }

  public validateGroup(group: string, isSubmitting: boolean = false, options: { skipAsyncValidation?: boolean } = {}): boolean {
    const fields = this.formValidation.getValidationGroupFields(group)
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

  public async validateFieldAsync(field: keyof FormBody, context: AsyncValidationContext = {}): Promise<boolean> {
    return await this.formValidation.validateFieldAsync(field, context)
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
    const fields = this.formValidation.getValidationGroupFields(group)
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
    for (const field of this.formValidation.getValidationGroupFields(group)) {
      this.touch(field)
    }
  }

  public fillState(data: Partial<FormBody>): void {
    const driver = this.formPersistence.getActiveDriver()
    for (const key of Object.keys(data) as Array<keyof FormBody>) {
      if (!Object.prototype.hasOwnProperty.call(data, key) || !(key in this.state)) {
        continue
      }

      const currentVal = this.state[key]
      const newVal = data[key] as FormBody[typeof key] | undefined

      if (currentVal instanceof PropertyAwareArray) {
        const values = newVal instanceof PropertyAwareArray || Array.isArray(newVal) ? Array.from(newVal) : []
        replacePropertyAwareArray(this.state, key, values)

        this.touched[key] = true
        continue
      }

      if (isPropertyAwareObject(currentVal)) {
        this.state[key] = restorePropertyAwareStructure(currentVal, newVal) as FormBody[typeof key]
        this.touched[key] = true
        continue
      }

      if (Array.isArray(newVal) && Array.isArray(currentVal)) {
        const merged = newVal.length === currentVal.length ? deepMergeArrays(currentVal, newVal) : newVal
        this.state[key] = merged as FormBody[typeof key]
        this.touched[key] = true
        continue
      }

      if (isRecord(newVal) && isRecord(currentVal)) {
        this.state[key] = shallowMerge({ ...currentVal }, newVal) as FormBody[typeof key]
        this.touched[key] = true
        continue
      }

      this.state[key] = newVal as FormBody[typeof key]
      this.touched[key] = true
    }
    this.persistState(driver)

    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key) && key in this.state) {
        this.validateField(key as keyof FormBody)
        this.formValidation.validateDependentFields(key as keyof FormBody)
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

  public buildPayload(): RequestBody {
    return buildFormPayload<RequestBody, FormBody>(this.state, {
      ignore: this.ignore,
      append: this.append,
      formName: this.constructor.name,
      getValueGetter: (name) => this.getValueGetter(name),
      getNoArgGetter: (name) => this.getNoArgGetter(name)
    })
  }

  public reset(): void {
    const driver = this.formPersistence.getActiveDriver()
    for (const key in this.state) {
      if (this.state[key] instanceof PropertyAwareArray) {
        const originalValue = this.original[key] as PropertyAwareArray
        const values = [...originalValue].map((item) => cloneFormValue(item))
        const typedKey = key as keyof FormBody
        replacePropertyAwareArray(this.state, typedKey, values as Array<ArrayItem<FormBody[typeof typedKey]>>)
        this.touched[typedKey] = false
      } else if (isPropertyAwareObject(this.state[key])) {
        this.state[key] = restorePropertyAwareStructure(this.original[key], cloneFormValue(this.original[key]))
        this.touched[key as keyof FormBody] = false
      } else {
        this.state[key] = cloneFormValue(this.original[key])
        this.touched[key as keyof FormBody] = false
      }
    }
    this.clearErrors()
    this.persistState(driver)

    this.validate()
  }

  protected addToArrayProperty<K extends keyof FormBody>(property: K, newElement: ArrayItem<FormBody[K]>): void {
    const driver = this.formPersistence.getActiveDriver()
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
    this.touched[property] = true
    this.persistState(driver)

    this.validateField(property)
    this.formValidation.validateDependentFields(property)
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
    this.formValidation.validateDependentFields(arrayIndex)
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
    return this.formBindings.properties
  }

  /**
   * Checks if the form or a specific field is dirty
   * @param field Optional field name to check, if not provided checks the entire form
   * @returns boolean indicating if the form or specified field is dirty
   */
  public isDirty(field?: keyof FormBody): boolean {
    // Read current values so nested object edits are visible immediately, before Vue watchers flush.
    return field === undefined ? !isEqual(this.state, this.original) : !isEqual(this.state[field], this.original[field])
  }

  /**
   * Returns whether the form has validation errors
   * @returns boolean indicating if the form has errors
   */
  public hasErrors(): boolean {
    return this.formErrors.hasErrors()
  }

  public getErrors(): Record<string, ErrorMessages> {
    return this.formErrors.flattenErrors()
  }

  public hasErrorsInGroup(group: string): boolean {
    return Object.keys(this.formErrors.flattenErrors()).some((errorKey) => this.formValidation.errorKeyBelongsToGroup(errorKey, group))
  }

  public getErrorsInGroup(group: string): Record<string, ErrorMessages> {
    const groupErrors: Record<string, ErrorMessages> = {}

    for (const [errorKey, errorMessages] of Object.entries(this.formErrors.flattenErrors())) {
      if (this.formValidation.errorKeyBelongsToGroup(errorKey, group)) {
        groupErrors[errorKey] = cloneFormValue(errorMessages)
      }
    }

    return groupErrors
  }

  /** Returns a detached snapshot of the current editable state. */
  public getStateSnapshot(): FormBody {
    return restorePropertyAwareStructure(this.state, cloneFormValue(toRaw(this.state)))
  }

  /** Accepts current or supplied saved values as the clean baseline. */
  public acceptSavedValues(values: FormBody = this.getStateSnapshot()): void {
    for (const key of Object.keys(this.state) as Array<keyof FormBody>) {
      const saved = restorePropertyAwareStructure(this.original[key], cloneFormValue(values[key]))
      this.original[key] = saved
      const current = this.state[key]
      if (!isEqual(toRaw(current), toRaw(saved))) {
        if (current instanceof PropertyAwareArray && Array.isArray(saved))
          replacePropertyAwareArray(this.state, key, cloneFormValue(Array.from(saved)))
        else this.state[key] = restorePropertyAwareStructure(current, cloneFormValue(saved))
      }
      this.touched[key] = false
    }
    this.persistState()
  }

  /** Explicitly replaces a field's current value and baseline. Ordinary edits use the property model. */
  public syncValue<K extends keyof FormBody>(key: K, value: FormBody[K]): void {
    const driver = this.formPersistence.getActiveDriver()
    const currentVal = this.state[key]

    if (currentVal instanceof PropertyAwareArray) {
      const arr = this.state[key] as PropertyAwareArray
      const originalArr = this.original[key] as PropertyAwareArray

      arr.length = 0
      originalArr.length = 0

      if (Array.isArray(value)) {
        value.forEach((item) => {
          arr.push(cloneFormValue(item))
          originalArr.push(cloneFormValue(item))
        })
      }

      this.touched[key] = true
    } else if (typeof currentVal === 'object' && currentVal !== null) {
      this.state[key] = cloneFormValue(value)
      this.original[key] = cloneFormValue(value)
      this.touched[key] = true
    } else {
      this.state[key] = value
      this.original[key] = value
      this.touched[key] = true
    }

    if (this.options?.persist === true) {
      this.persistState(driver)
    }

    this.validateField(key)
    this.formValidation.validateDependentFields(key)
  }
}
