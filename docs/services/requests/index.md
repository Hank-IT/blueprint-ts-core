# Defining Requests

Each API endpoint is represented as a separate class that extends `BaseRequest`. This class specifies the HTTP Method,
URL, and the expected request/response types.

## Example: Expense Index Request

The following example demonstrates how to define a GET request to the `/api/v1/expenses` endpoint:

```typescript
import { BaseRequest, RequestMethodEnum, JsonResponse } from '@blueprint-ts/core/service/requests'

export interface GenericResponseErrorInterface {
    message: string
}

export interface ExpenseIndexRequestParams {
    filter?: {
        search_text?: string
    };
}

export interface ExpenseResource {
    id: string;
    // other data fields
}

export interface ExpenseIndexRequestResponseBody {
    data: ExpenseResource[]
}

export class ExpenseIndexRequest extends BaseRequest<
        boolean, // Generic RequestLoaderLoadingType
        GenericResponseErrorInterface, // Generic ResponseErrorBody
        ExpenseIndexRequestResponseBody, // Generic ResponseBodyInterface
        JsonResponse<ExpenseIndexRequestResponseBody>, // Generic ResponseClass
        undefined, // Generic RequestBodyInterface
        ExpenseIndexRequestParams // RequestParamsInterface
> {
    public method(): RequestMethodEnum {
        return RequestMethodEnum.GET
    }

    public url(): string {
        return '/api/v1/expenses'
    }
}
```

## Explanation

- **HTTP Method**: Uses `GET` to retrieve data from the `/api/v1/expenses` endpoint.
- **Error Handling**: On failure (4XX/5XX status codes), the response will conform to `GenericResponseErrorInterface`.
- **Success Response**: A successful response is expected to follow the `ExpenseIndexRequestResponseBody` interface.
- **Response Format**: The response is of type JSON, as indicated by `JsonResponse`.
- **Request Body**: Since this is a GET request, the body is `undefined`.
- **Query Parameters**: Accepts query parameters that match the `ExpenseIndexRequestParams` interface.

---

## Sending the Request

Once the request is defined, you can send it using the following code:

```typescript
const request = new ExpenseIndexRequest()

// The response type and body are inferred automatically.
const response: JsonResponse<ExpenseIndexRequestResponseBody> = await request.send()

const body = response.getBody() // Type: ExpenseIndexRequestResponseBody
```

This completes the setup and usage of the request driver and custom requests. You can now use these patterns to create additional requests as needed.