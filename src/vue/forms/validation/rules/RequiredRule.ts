import { BaseRule } from './BaseRule'

export class RequiredRule<FormBody extends object> extends BaseRule<FormBody> {
  public constructor(protected message: string = 'This field is required') {
    super()
  }

  public validate(value: keyof FormBody): boolean {
    if (value === null || value === undefined || value === '') {
      return false
    }

    return true
  }

  public getMessage(): string {
    return this.message
  }
}
