import { BaseRule } from './BaseRule'

export class JsonRule<FormBody extends object> extends BaseRule<FormBody> {
  public constructor(protected message: string = 'Please enter valid JSON') {
    super()
  }

  public validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') {
      return true
    }

    if (typeof value !== 'string') {
      return false
    }

    try {
      JSON.parse(value)
      return true
    } catch {
      return false
    }
  }

  public getMessage(): string {
    return this.message
  }
}
