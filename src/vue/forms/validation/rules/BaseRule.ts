export interface AsyncValidationContext {
  field: string
  payload: Record<string, unknown>
  isSubmitting: boolean
}

export abstract class BaseRule<FormBody extends object> {
  public dependsOn: Array<keyof FormBody> = []

  public abstract validate(value: unknown, state: FormBody): boolean

  public abstract getMessage(): string

  // eslint-disable-next-line  @typescript-eslint/no-unused-vars
  public async validateAsync(_value: unknown, _state: FormBody, _context: AsyncValidationContext): Promise<Record<string, string[]> | null> {
    return null
  }

  // eslint-disable-next-line  @typescript-eslint/no-unused-vars
  public getAsyncValidationPaths(field: keyof FormBody, _state: FormBody): string[] {
    return [String(field)]
  }
}
