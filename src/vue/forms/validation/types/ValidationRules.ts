import { type BaseRule } from '../rules/BaseRule'
import { type BidirectionalRule } from './BidirectionalRule'
import { type ValidationMode } from '../ValidationMode.enum'

type Rule<FormBody extends object> = BaseRule<FormBody> & Partial<BidirectionalRule<FormBody>>
type ValidationGroupPath<FormBody extends object> = Extract<keyof FormBody, string> | string

export type ValidationRules<FormBody extends object> = Partial<
  Record<
    keyof FormBody,
    {
      rules: Rule<FormBody>[]
      options?: { mode?: ValidationMode; asyncDebounceMs?: number }
    }
  >
>

export type ValidationGroups<FormBody extends object> = Partial<Record<string, ValidationGroupPath<FormBody>[]>>
