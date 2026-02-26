import { ResponseBodyException } from './ResponseBodyException'

export class UnauthorizedException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
