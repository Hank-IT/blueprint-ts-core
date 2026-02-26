/**
 * Interface for rules that require bidirectional validation
 * Rules implementing this interface will have their dependencies
 * automatically set up bidirectionally
 */
export interface BidirectionalRule<FormBody extends object = object> {
  /**
   * Returns the fields that should have bidirectional validation with the current field
   */
  getBidirectionalFields(): Array<keyof FormBody>
}
