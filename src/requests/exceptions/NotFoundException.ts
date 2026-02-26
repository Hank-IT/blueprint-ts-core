import { ResponseBodyException } from './ResponseBodyException'

export class NotFoundException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
