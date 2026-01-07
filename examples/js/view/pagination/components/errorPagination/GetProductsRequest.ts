import {BaseRequest, type Paginatable, JsonResponse } from '@hank-it/ui/service/requests'
import type {PaginationResponseContract} from '@hank-it/ui/service/pagination'

export interface ProductResource {
    id: number
    title: string
    description: string
}

export interface ProductPaginationResource {
    products: ProductResource[]
    total: number
    limit: number
    skip: number
}

export class GetProductsRequestResponse extends JsonResponse implements PaginationResponseContract {
    public getData() {
        return this.data
    }

    public getTotal(): number {
        return this.body.total
    }

    public dataHandler(data) {
        return data.products
    }
}

export class GetProductsRequest extends BaseRequest implements Paginatable {
    method() {
        return 'GET'
    }

    url() {
        return 'https://dummyjson.com/http/500'
    }

    public setPaginationParams(page: number, size: number): BaseRequest {
        return this.withParams({
            skip: (page - 1) * size,
            limit: size,
        })
    }

    public getCorsWithCredentials(): boolean {
        return false
    }

    protected getResponse() {
        return new GetProductsRequestResponse
    }
}