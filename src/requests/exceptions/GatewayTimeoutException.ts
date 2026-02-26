import { ResponseBodyException } from './ResponseBodyException'

export class GatewayTimeoutException<ResponseErrorBody> extends ResponseBodyException<ResponseErrorBody> {}
