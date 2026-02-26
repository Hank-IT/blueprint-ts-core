import { ResponseBodyException } from './ResponseBodyException'

export class UnsupportedMediaTypeException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
