import { ResponseBodyException } from './ResponseBodyException'

export class RequestTimeoutException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
