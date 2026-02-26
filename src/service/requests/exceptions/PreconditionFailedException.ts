import { ResponseBodyException } from './ResponseBodyException'

export class PreconditionFailedException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
