import { ResponseBodyException } from './ResponseBodyException'

export class BadRequestException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
