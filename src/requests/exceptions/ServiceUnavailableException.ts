import { ResponseBodyException } from './ResponseBodyException'

export class ServiceUnavailableException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
