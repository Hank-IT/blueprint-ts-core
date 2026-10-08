import type { PropertyAwareArray, PropertyAwareField } from '../PropertyAwareArray'
import type { PropertyAwareObject } from '../PropertyAwareObject'

export type ErrorMessages = string[]
export interface ErrorObject {
  [key: string]: FieldErrors
}
export type ErrorArray = Array<ErrorObject>
export type FieldErrors = ErrorMessages | ErrorObject | ErrorArray
export type ErrorBag = Record<string, FieldErrors>

export type FieldProperty<T> = PropertyAwareField<T>

export type NestedPropertyAwareValue<T> =
  T extends PropertyAwareArray<infer Item>
    ? ArrayProperty<Item>
    : T extends PropertyAwareObject<infer Shape>
      ? ObjectProperty<Shape>
      : FieldProperty<T>

export type ArrayProperty<T> = Array<T extends object ? { [P in keyof T]: NestedPropertyAwareValue<T[P]> } : { value: FieldProperty<T> }>
export type ObjectProperty<T extends object> = { [K in keyof T]: NestedPropertyAwareValue<T[K]> }

export type PropertyAwareToRaw<T> =
  T extends Array<infer U>
    ? Array<PropertyAwareToRaw<U>>
    : T extends PropertyAwareObject<infer Shape>
      ? { [K in keyof Shape]: PropertyAwareToRaw<Shape[K]> }
      : T extends { model: { value: infer V } }
        ? V
        : T extends object
          ? { [K in keyof T]: PropertyAwareToRaw<T[K]> }
          : T

export type FormKey<FormBody extends object> = Extract<keyof FormBody, string>
export type RequestKey<RequestBody extends object> = Extract<keyof RequestBody, string>
export type ArrayItem<T> = T extends Array<infer Item> ? Item : never
export type PropertyAwareInput<T> = T extends PropertyAwareArray<infer Item> ? Array<Item> | PropertyAwareArray<Item> : T

export type FormProperties<FormBody extends object> = {
  [K in keyof FormBody]: FormBody[K] extends PropertyAwareArray<infer Item>
    ? ArrayProperty<Item>
    : FormBody[K] extends PropertyAwareObject<infer Shape>
      ? ObjectProperty<Shape>
      : FieldProperty<FormBody[K]>
}

export interface ValidationContext {
  isDirty?: boolean
  isSubmitting?: boolean
  isDependentChange?: boolean
  isTouched?: boolean
}

export interface AsyncValidationContext extends ValidationContext {
  skipSyncValidation?: boolean
  skipAsyncValidation?: boolean
}

export interface BaseFormOptions {
  persist?: boolean
  persistKey?: string
  persistSuffix?: string
}
