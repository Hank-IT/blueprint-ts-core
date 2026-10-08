import { computed, reactive } from 'vue'
import { cloneFormValue, isRecord } from './formValues'
import type { ErrorMessages, ErrorObject, ErrorArray, ErrorBag, FieldErrors } from './types'

function isErrorMessages(value: unknown): value is ErrorMessages {
  return Array.isArray(value) && (value.length === 0 || typeof value[0] === 'string')
}

function isErrorArray(value: unknown): value is ErrorArray {
  return Array.isArray(value) && value.some((item) => isRecord(item))
}

function isErrorObject(value: unknown): value is ErrorObject {
  return isRecord(value)
}

export function matchesFieldPath(errorKey: string, path: string): boolean {
  return errorKey === path || errorKey.startsWith(`${path}.`)
}

/** Stores synchronous/external and asynchronous errors without owning form values or rules. */
export class FormErrors {
  private readonly _errors: ErrorBag = reactive<ErrorBag>({})
  private readonly _asyncErrors: ErrorBag = reactive<ErrorBag>({})
  private readonly _hasErrors = computed(() => Object.keys(this.flattenErrors()).length > 0)

  public hasErrors(): boolean {
    return this._hasErrors.value
  }

  public resetField(field: string): void {
    this._errors[field] = []
  }

  public addFieldError(field: string, message: string): void {
    this.getOrCreateFieldErrors(field).push(message)
  }

  public hasSyncErrors(field: string): boolean {
    const errors = this._errors[field]
    return isErrorMessages(errors) && errors.length > 0
  }

  public replaceAsyncErrors(paths: string[], next: ErrorBag): void {
    this.clearErrorBagPaths(this._asyncErrors, paths)
    for (const [key, messages] of Object.entries(this.flattenErrorsFromBag(next))) {
      this.applyErrors({ [key]: messages }, undefined, this._asyncErrors)
    }
  }

  private clearErrorBag(errorBag: ErrorBag): void {
    for (const key in errorBag) {
      delete errorBag[key]
    }
  }

  public clearSyncErrors(): void {
    this.clearErrorBag(this._errors)
  }

  public clearAsyncErrors(): void {
    this.clearErrorBag(this._asyncErrors)
  }

  private flattenErrorValue(value: FieldErrors | undefined, path: string, flattened: Record<string, ErrorMessages>): void {
    if (value === undefined) {
      return
    }

    if (isErrorMessages(value)) {
      if (value.length > 0) {
        flattened[path] = cloneFormValue(value)
      }
      return
    }

    if (isErrorArray(value)) {
      value.forEach((item, index) => {
        const itemPath = `${path}.${index}`
        if (isErrorMessages(item)) {
          if (item.length > 0) {
            flattened[itemPath] = cloneFormValue(item)
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
      flattened[path] = cloneFormValue(rootErrors)
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

  public flattenErrors(): Record<string, ErrorMessages> {
    const flattened = this.flattenErrorsFromBag(this._errors)

    for (const [key, messages] of Object.entries(this.flattenErrorsFromBag(this._asyncErrors))) {
      flattened[key] = this.mergeErrorMessages(flattened[key] ?? [], messages)
    }

    return flattened
  }

  public applyErrors<ErrorInterface extends Record<string, FieldErrors>>(
    errorsData: ErrorInterface,
    errorMap?: Record<string, string | string[]>,
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

      if (errorMap) {
        const mapping = errorMap[serverKey]
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

  public collectSiblingNestedErrors(field: string, path: string[]): Record<string, ErrorMessages> {
    if (path.length === 0) {
      return {}
    }

    const fieldKey = String(field)
    const clearedPath = `${fieldKey}.${path.join('.')}`
    const preservedErrors: Record<string, ErrorMessages> = {}

    for (const [errorKey, errorValue] of Object.entries(this.flattenErrors())) {
      if (!matchesFieldPath(errorKey, fieldKey)) {
        continue
      }

      if (errorKey === clearedPath || errorKey.startsWith(`${clearedPath}.`)) {
        continue
      }

      preservedErrors[errorKey] = cloneFormValue(errorValue)
    }

    return preservedErrors
  }

  private clearErrorBagPaths(errorBag: ErrorBag, paths: string[]): void {
    const preservedErrors: Record<string, ErrorMessages> = {}

    for (const [errorKey, errorValue] of Object.entries(this.flattenErrorsFromBag(errorBag))) {
      if (!paths.some((path) => matchesFieldPath(errorKey, path))) {
        preservedErrors[errorKey] = cloneFormValue(errorValue)
      }
    }

    this.clearErrorBag(errorBag)
    this.applyErrors(preservedErrors, undefined, errorBag)
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

  public getFieldErrors(field: string): ErrorMessages {
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

  public getArrayItemFieldErrors(field: string, index: number, innerKey: string): ErrorMessages {
    return this.mergeErrorMessages(
      this.getNestedErrorMessagesFromValue(this.getArrayItemErrors(field, index), innerKey.split('.')),
      this.getNestedErrorMessagesFromValue(this.getArrayItemErrorsFromBag(this._asyncErrors, field, index), innerKey.split('.'))
    )
  }

  public getArrayItemErrorMessages(field: string, index: number): ErrorMessages {
    return this.mergeErrorMessages(
      this.getArrayItemErrorMessagesFromBag(this._errors, field, index),
      this.getArrayItemErrorMessagesFromBag(this._asyncErrors, field, index)
    )
  }

  public getObjectFieldErrors(field: string, path: string[]): ErrorMessages {
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
}
