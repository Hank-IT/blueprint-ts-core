import { ResponseBodyException } from './ResponseBodyException'

export class ServerErrorException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
