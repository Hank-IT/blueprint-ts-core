export class UnsupportedTransportOptionException extends Error {
  public constructor(option: string, transport: string) {
    super(`${transport} does not support ${option}.`)
    this.name = 'UnsupportedTransportOptionException'
  }
}
