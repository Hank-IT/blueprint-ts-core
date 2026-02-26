import { ResponseBodyException } from './ResponseBodyException'

export class TooManyRequestsException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
