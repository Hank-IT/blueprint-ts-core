import { BaseRule } from './BaseRule'
import { type BidirectionalRule } from '../types/BidirectionalRule'

export class ConfirmedRule<FormBody extends object> extends BaseRule<FormBody> implements BidirectionalRule<FormBody> {
  protected message: string

  public constructor(
    protected confirmationField: keyof FormBody,
    message?: string
  ) {
    super()

    this.message = message || `Must match ${String(confirmationField)}`

    // Add the confirmation field as a dependency
    this.dependsOn = [confirmationField]
  }

  public validate(value: unknown, formState: FormBody): boolean {
    // Only validate if both fields have values
    const confirmationValue = formState[this.confirmationField]

    // If either field is empty, don't show an error yet
    if (!value || !confirmationValue) {
      return true
    }

    return value === confirmationValue
  }

  public getMessage(): string {
    return this.message
  }

  // Implement BidirectionalRule interface
  public getBidirectionalFields(): Array<keyof FormBody> {
    return [this.confirmationField]
  }
}
