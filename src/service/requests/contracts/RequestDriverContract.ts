import { RequestMethodEnum } from '../RequestMethod.enum'
import { type HeadersContract } from './HeadersContract'
import { type BodyContract } from './BodyContract'
import { type ResponseHandlerContract } from '../drivers/contracts/ResponseHandlerContract'
import { type DriverConfigContract } from './DriverConfigContract'

export interface RequestDriverContract {
  send(
    url: URL | string,
    method: RequestMethodEnum,
    headers: HeadersContract,
    body?: BodyContract,
    requestConfig?: DriverConfigContract
  ): Promise<ResponseHandlerContract>
}
