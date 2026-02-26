import { ResponseBodyException } from './ResponseBodyException'

export class GoneException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
