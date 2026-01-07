import {BaseRequest, BaseResponse } from '@hank-it/ui/service/requests'
import DriverConfigContract from '../../../../../../src/service/requests/contracts/DriverConfigContract'
import JsonResponse from '../../../../../../src/service/requests/responses/JsonResponse'

export class GetProductsRequestResponse extends JsonResponse {}

export class GetProductsRequest extends BaseRequest implements GetProductsRequest {
    method() {
        return 'GET'
    }

    url() {
        return 'https://dummyjson.com/products/?delay=5000'
    }

    protected getConfig(): DriverConfigContract {
        return {
            corsWithCredentials: false,
        }
    }

    protected getResponse() {
        return new GetProductsRequestResponse
    }
}