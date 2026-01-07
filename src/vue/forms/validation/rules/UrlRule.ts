import { BaseRule } from './BaseRule'

export class UrlRule<FormBody extends object> extends BaseRule<FormBody> {
  public constructor(protected message: string = 'Please enter a valid URL') {
    super()
  }

  public validate(value: unknown): boolean {
    if (!value || typeof value !== 'string') {
      return false
    }

    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  }

  public getMessage(): string {
    return this.message
  }
}
