# Working with Laravel Pagination
The `PaginationJsonBaseRequest` class extends the functionality to handle Laravel's pagination response format.

## RequestDriver

Use the Laravel `RequestDriver` to turn a `PaginationJsonBaseRequest` into a pagination data driver for the core
paginator classes.

## Example: Paginated Users List

````typescript
import { PaginationJsonBaseRequest } from '@blueprint-ts/core/service/laravel/requests'
import { PaginationResponse } from '@blueprint-ts/core/service/laravel/requests/responses'
import { RequestDriver } from '@blueprint-ts/core/service/laravel/pagination'
import { PageAwarePaginator } from '@blueprint-ts/core/service/pagination'

export interface UserListParams {
  search?: string
  sort_by?: string
  sort_direction?: 'asc' | 'desc'
  page?: number
  per_page?: number
}

// Paginated GET request to list users
export class UserIndexRequest extends PaginationJsonBaseRequest<
  boolean, // Loading indicator type
  LaravelErrorResponse, // Laravel-style error response
  UserResource, // The resource type being paginated
  undefined, // No request body for GET
  UserListParams // Query parameters including pagination
> {
  public method(): RequestMethodEnum {
    return RequestMethodEnum.GET
  }

  public url(): string {
    return '/api/users'
  }
}
````

And now we send the request using the paginator:

````typescript
const request = new UserIndexRequest()

const paginator = new PageAwarePaginator(new RequestDriver(request))

// Fetch the initial data
paginator.load(1)

// Get current page data
paginator.getPageData()

// Change page
await paginator.setPageSize(value).load()

// Get current page size
paginator.getPageSize()
````

## Types

For stricter typing, the Laravel pagination package also exports:

- `PaginationResponseBodyContract` for the expected pagination response body shape
