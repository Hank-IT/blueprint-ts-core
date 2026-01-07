import {BaseRequest, type Paginatable, type DriverConfigContract, JsonResponse } from '@hank-it/ui/service/requests'

export class GetProductsRequestResponse extends JsonResponse {
    public dataHandler(data) {
        return data.products
    }
}

export class GetProductsRequest extends BaseRequest implements Paginatable {
    method() {
        return 'GET'
    }

    url() {
        return 'https://dummyjson.com/products/search'
    }

    public setPaginationParams(page: number, size: number): BaseRequest {
        return this.withParams({
            skip: (page - 1) * size,
            limit: size,
        })
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