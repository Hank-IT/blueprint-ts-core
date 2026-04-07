export class MockRequestAssertionError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'MockRequestAssertionError'
  }
}
