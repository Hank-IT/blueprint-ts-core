import { ResponseBodyException } from './ResponseBodyException'

export class MethodNotAllowedException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
