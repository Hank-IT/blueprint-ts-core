import { BaseRule } from './BaseRule'

export class MinRule<FormBody extends object> extends BaseRule<FormBody> {
  /**
   * Creates a new MinRule
   * @param min The minimum value (length for strings, value for numbers, length for arrays)
   * @param message The error message to display if validation fails
   */
  public constructor(
    protected min: number,
    protected message?: string
  ) {
    super()
  }

  /**
   * Validates that the value meets the minimum requirement
   * - For strings: checks if length is at least the specified minimum
   * - For numbers: checks if value is at least the specified minimum
   * - For arrays: checks if length is at least the specified minimum
   * - For other types: always returns false
   *
   * @param value The value to validate
   * @returns boolean indicating if validation passed
   */
  public validate(value: unknown): boolean {
    // Null or undefined values should be handled by RequiredRule, not this rule
    if (value === null || value === undefined) {
      return true
    }

    // For strings, check the length
    if (typeof value === 'string') {
      return value.length >= this.min
    }

    // For numbers, check the value
    if (typeof value === 'number') {
      return value >= this.min
    }

    // For arrays, check the length
    if (Array.isArray(value)) {
      return value.length >= this.min
    }

    // For other types, validation fails
    return false
  }

  /**
   * Returns the error message for the validation
   */
  public getMessage(): string {
    if (this.message) {
      return this.message
    }

    return `This field must be at least ${this.min}`
  }
}
