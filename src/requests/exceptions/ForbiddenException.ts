import { ResponseBodyException } from './ResponseBodyException'

export class ForbiddenException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
