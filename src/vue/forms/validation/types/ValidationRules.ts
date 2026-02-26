import { type BaseRule } from '../rules/BaseRule'
import { type ValidationMode } from '../ValidationMode.enum'

export type ValidationRules<FormBody extends object> = Partial<
  Record<
    keyof FormBody,
    {
      rules: BaseRule<FormBody>[]
      options?: { mode?: ValidationMode }
    }
  >
>
