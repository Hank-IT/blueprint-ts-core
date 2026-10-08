import { reactive } from 'vue'
import { debounce, type DebouncedFunc } from 'lodash-es'
import { BaseRule } from '../validation/rules/BaseRule'
import { ValidationMode, type ValidationRules, type ValidationGroups } from '../validation'
import { FormErrors, matchesFieldPath } from './FormErrors'
import type { ValidationContext, AsyncValidationContext, ErrorBag, FieldErrors } from './types'

interface ValidationAccess<FormBody extends object> {
  state(): FormBody
  rules(): ValidationRules<FormBody>
  groups(): ValidationGroups<FormBody>
  isDirty(field: keyof FormBody): boolean
  isTouched(field: keyof FormBody): boolean
  validateField(field: keyof FormBody, context?: AsyncValidationContext): void
  buildPayload(): object
}

/** Owns rule dependencies and pending validation work. Form callbacks retain subclass dispatch. */
export class FormValidation<FormBody extends object> {
  private readonly fieldDependencies = new Map<keyof FormBody, Set<keyof FormBody>>()
  private readonly asyncValidationDebouncers = new Map<keyof FormBody, DebouncedFunc<() => void>>()
  private readonly pendingAsyncValidationContexts = new Map<keyof FormBody, { token: number; context: ValidationContext }>()
  private readonly asyncValidationTokens = reactive<Record<string, number>>({})

  public constructor(
    private readonly access: ValidationAccess<FormBody>,
    private readonly errors: FormErrors
  ) {}

  public buildFieldDependencies(): void {
    for (const field in this.access.rules()) {
      if (Object.prototype.hasOwnProperty.call(this.access.rules(), field)) {
        const fieldRules = this.access.rules()[field as keyof FormBody]?.rules || []

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

  public validateDependentFields(changedField: keyof FormBody): void {
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
        this.access.validateField(field, {
          isDependentChange: true,
          isSubmitting: false
        })
      }
    }
  }

  private hasAsyncRules(field: keyof FormBody): boolean {
    const fieldConfig = this.access.rules()[field]
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

  public cancelPendingAsyncValidations(): void {
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
    const debounceMs = this.access.rules()[field]?.options?.asyncDebounceMs ?? 0

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

  public getValidationGroupPaths(group: string): string[] {
    const paths = this.access.groups()[group]

    if (!paths || paths.length === 0) {
      return []
    }

    return [...paths]
  }

  public errorKeyBelongsToGroup(errorKey: string, group: string): boolean {
    return this.getValidationGroupPaths(group).some((groupPath) => matchesFieldPath(errorKey, groupPath))
  }

  public getValidationGroupFields(group: string): Array<keyof FormBody> {
    const fields: Array<keyof FormBody> = []

    for (const path of this.getValidationGroupPaths(group)) {
      const [topLevelField] = path.split('.')
      if (!topLevelField || !(topLevelField in this.access.state())) {
        continue
      }

      const typedField = topLevelField as keyof FormBody
      if (!fields.includes(typedField)) {
        fields.push(typedField)
      }
    }

    return fields
  }

  public validateField(field: keyof FormBody, context: AsyncValidationContext = {}): void {
    const errorKey = String(field)
    this.errors.resetField(errorKey)

    const value = this.access.state()[field]

    const fieldConfig = this.access.rules()[field]
    if (!fieldConfig?.rules || fieldConfig.rules.length === 0) {
      return // No rules to validate
    }

    const mode = fieldConfig.options?.mode ?? ValidationMode.DEFAULT

    const isDirty = context.isDirty !== undefined ? context.isDirty : this.access.isDirty(field)
    const isTouched = context.isTouched !== undefined ? context.isTouched : this.access.isTouched(field)

    const shouldValidate =
      (context.isSubmitting && mode & ValidationMode.ON_SUBMIT) ||
      (isDirty && mode & ValidationMode.ON_DIRTY) ||
      (isTouched && mode & ValidationMode.ON_TOUCH) ||
      mode & ValidationMode.INSTANTLY ||
      (context.isDependentChange && mode & ValidationMode.ON_DEPENDENT_CHANGE)

    if (shouldValidate) {
      for (const rule of fieldConfig.rules) {
        const isValid = rule.validate(value, this.access.state())
        if (!isValid) {
          this.errors.addFieldError(errorKey, rule.getMessage())
        }
      }

      if (!context.skipAsyncValidation) {
        this.scheduleAsyncValidation(field, context)
      }
    }
  }

  private async runFieldAsyncValidation(field: keyof FormBody, context: AsyncValidationContext = {}, expectedToken?: number): Promise<boolean> {
    if (!context.skipSyncValidation) {
      this.access.validateField(field, {
        ...context,
        skipAsyncValidation: true
      })
    }

    const fieldConfig = this.access.rules()[field]
    if (!fieldConfig?.rules || fieldConfig.rules.length === 0) {
      return !Object.keys(this.errors.flattenErrors()).some((errorKey) => matchesFieldPath(errorKey, String(field)))
    }

    const asyncPaths = fieldConfig.rules.flatMap((rule) => rule.getAsyncValidationPaths(field, this.access.state()))
    const payload = this.access.buildPayload() as Record<string, unknown>
    const nextAsyncErrors: ErrorBag = {}

    for (const rule of fieldConfig.rules) {
      const errors = await rule.validateAsync(this.access.state()[field], this.access.state(), {
        field: String(field),
        payload,
        isSubmitting: context.isSubmitting ?? false
      })

      if (errors && Object.keys(errors).length > 0) {
        this.errors.applyErrors(errors as Record<string, FieldErrors>, undefined, nextAsyncErrors)
      }
    }

    if (expectedToken !== undefined && this.asyncValidationTokens[String(field)] !== expectedToken) {
      return !Object.keys(this.errors.flattenErrors()).some((errorKey) => matchesFieldPath(errorKey, String(field)))
    }

    this.errors.replaceAsyncErrors(asyncPaths, nextAsyncErrors)

    return !Object.keys(this.errors.flattenErrors()).some((errorKey) => matchesFieldPath(errorKey, String(field)))
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
}
