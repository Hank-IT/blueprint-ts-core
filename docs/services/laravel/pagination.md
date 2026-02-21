# Working with Laravel Pagination
The `PaginationJsonBaseRequest` class extends the functionality to handle Laravel's pagination response format.

## Example: Paginated Users List

````typescript
import { PaginationJsonBaseRequest } from '@blueprint-ts/core/service/laravel/requests'
import { PaginationResponse } from '@blueprint-ts/core/service/laravel/requests/responses'

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

const paginator = new Paginator(new RequestDriver(request))

// Fetch the initial data
paginator.init(1, 10)

// Get current page data
paginator.getPageData()

// Change page
paginator.setPageSize(value)

// Get current page size
paginator.getPageSize()
````