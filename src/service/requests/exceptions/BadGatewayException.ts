import { ResponseBodyException } from './ResponseBodyException'

export class BadGatewayException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
