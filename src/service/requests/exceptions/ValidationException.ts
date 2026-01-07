import { ResponseBodyException } from './ResponseBodyException'

export class ValidationException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
