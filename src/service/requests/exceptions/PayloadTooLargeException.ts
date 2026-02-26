import { ResponseBodyException } from './ResponseBodyException'

export class PayloadTooLargeException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
