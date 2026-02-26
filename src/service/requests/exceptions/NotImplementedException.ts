import { ResponseBodyException } from './ResponseBodyException'

export class NotImplementedException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
