export abstract class BaseRule<FormBody extends object> {
  public dependsOn: Array<keyof FormBody> = []

  public abstract validate(value: unknown, state: FormBody): boolean

  public abstract getMessage(): string
}
