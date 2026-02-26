import { ResponseBodyException } from './ResponseBodyException'

export class LockedException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
