export class StaleResponseException extends Error {
  public readonly cause: unknown

  public constructor(message: string = 'Stale response ignored', cause?: unknown) {
    super(message)
    this.name = 'StaleResponseException'
    this.cause = cause
  }

  public getCause(): unknown {
    return this.cause
  }
}
