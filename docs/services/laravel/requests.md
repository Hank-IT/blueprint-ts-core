# Laravel Request Integration
The Laravel integration provides specialized request classes that work seamlessly with Laravel backend APIs, handling common Laravel-specific response formats and features like pagination.

## Using JsonBaseRequest
The `JsonBaseRequest` class is designed to work with Laravel's JSON responses, automatically handling content negotiation and response parsing. 

### Example: User API Request

We assume that Laravel's resources are used which output the requested data on the `data` json key.

````typescript
import { JsonBaseRequest } from '@blueprint-ts/core/service/laravel/requests'

export interface LaravelErrorResponse {
  message: string;
  errors?: Record<string, string[]>
}

export interface UserResource {
  id: number
  name: string
  email: string
  created_at: string
}

export interface UserRequestParams {
  include?: string[]
}

// Simple GET request to fetch a user
export class UserShowRequest extends JsonBaseRequest<
  boolean, // Loading indicator type
  LaravelErrorResponse, // Laravel-style error response
  UserResource, // Response data structure
  undefined, // No request body for GET
  UserRequestParams // Query parameters
> {
  constructor(private userId: number) {
    super()
  }

  public method(): RequestMethodEnum {
    return RequestMethodEnum.GET
  }

  public url(): string {
    return `/api/users/${this.userId}`
  }
}
````

## Sending the Request

Once the request is defined, you can send it using the following code:

```typescript
const request = new UserShowRequest()

const response: JsonResponse<UserResource> = await request.send()

const data: UserResource[] = response.getData()
```