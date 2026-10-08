import { ResponseBodyException } from './ResponseBodyException'

export class PreconditionRequiredException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
