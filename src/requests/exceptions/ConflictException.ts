import { ResponseBodyException } from './ResponseBodyException'

export class ConflictException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
