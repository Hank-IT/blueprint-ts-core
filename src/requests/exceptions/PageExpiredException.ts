import { ResponseBodyException } from './ResponseBodyException'

export class PageExpiredException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
