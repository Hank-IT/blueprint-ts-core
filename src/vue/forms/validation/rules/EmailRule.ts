import { BaseRule } from './BaseRule'

export class EmailRule<FormBody extends object> extends BaseRule<FormBody> {
  public constructor(protected message: string = 'Please enter a valid email address') {
    super()
  }

  public validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
      return true
    }

    if (typeof value !== 'string') {
      return false
    }

    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)
  }

  public getMessage(): string {
    return this.message
  }
}
