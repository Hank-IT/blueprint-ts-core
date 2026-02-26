# Getting Started

Each API endpoint is represented as a separate class that extends `BaseRequest`. This class specifies the HTTP Method,
URL, and the expected request/response types.

## Request Handling

The library leverages a fetch-based driver to perform HTTP requests. The following sections explain how to initialize
the request driver and define custom requests.

## Initializing the Request Driver

Before making any requests, you must initialize the appropriate request driver. This is done during your application's
boot process by using the static `setRequestDriver` method.

### Using the Fetch Driver

To set up the fetch driver, import `BaseRequest` and `FetchDriver` from '@blueprint-ts/core/service/requests' and initialize
the driver as shown:

```typescript
import { BaseRequest, FetchDriver } from '@blueprint-ts/core/service/requests'

BaseRequest.setRequestDriver(new FetchDriver())
```

### Enabling Credential Support

If your requests need to include credentials (e.g., cookies for cross-origin requests), enable credential support as
follows:

```typescript
BaseRequest.setRequestDriver(new FetchDriver({
    corsWithCredentials: true,
}))
```

### Adding Global Headers

To include headers such as a CSRF token with every request, define them globally:

```typescript
BaseRequest.setRequestDriver(new FetchDriver({
    headers: {
        'X-XSRF-TOKEN': "<token>",
    },
}))
```

Sometimes you want to refetch the header when the request is sent. You may specify a callback for this:

```typescript
BaseRequest.setRequestDriver(new FetchDriver({
    headers: {
        'X-XSRF-TOKEN': () => getCookie('XSRF-TOKEN')
    },
}))
```

### Specifying a Base URL

In case your backend lives on a separate domain, you may specify a default base url, which is prepended to every request url:

```typescript
BaseRequest.setDefaultBaseUrl('https://example.com')
```

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

### Explanation

- **HTTP Method**: Uses `GET` to retrieve data from the `/api/v1/expenses` endpoint.
- **Error Handling**: On failure (4XX/5XX status codes), the response will conform to `GenericResponseErrorInterface`.
- **Success Response**: A successful response is expected to follow the `ExpenseIndexRequestResponseBody` interface.
- **Response Format**: The response is of type JSON, as indicated by `JsonResponse`.
- **Request Body**: Since this is a GET request, the body is `undefined`.
- **Query Parameters**: Accepts query parameters that match the `ExpenseIndexRequestParams` interface.

### Sending the Request

Once the request is defined, you can send it using the following code:

```typescript
const request = new ExpenseIndexRequest()

// The response type and body are inferred automatically.
const response: JsonResponse<ExpenseIndexRequestResponseBody> = await request.send()

const body = response.getBody() // Type: ExpenseIndexRequestResponseBody
```

## Example: Create Expense Request (POST)

This example demonstrates a POST request that sends a JSON body by overriding `getRequestBodyFactory()`:

```typescript
import {
    BaseRequest,
    RequestMethodEnum,
    JsonResponse,
    JsonBodyFactory
} from '@blueprint-ts/core/service/requests'

export interface CreateExpensePayload {
    title: string
    amount: number
}

export interface CreateExpenseResponseBody {
    id: string
}

export class CreateExpenseRequest extends BaseRequest<
        boolean,
        GenericResponseErrorInterface,
        CreateExpenseResponseBody,
        JsonResponse<CreateExpenseResponseBody>,
        CreateExpensePayload
> {
    public method(): RequestMethodEnum {
        return RequestMethodEnum.POST
    }

    public url(): string {
        return '/api/v1/expenses'
    }

    public getResponse(): JsonResponse<CreateExpenseResponseBody> {
        return new JsonResponse<CreateExpenseResponseBody>()
    }

    public override getRequestBodyFactory() {
        return new JsonBodyFactory<CreateExpensePayload>()
    }
}
```

### Explanation

- **HTTP Method**: Uses `POST` to create a new expense.
- **Error Handling**: On failure (4XX/5XX status codes), the response will conform to `GenericResponseErrorInterface`.
- **Success Response**: A successful response is expected to follow the `CreateExpenseResponseBody` interface.
- **Response Format**: The response is of type JSON, as indicated by `JsonResponse`.
- **Request Body**: Uses `JsonBodyFactory` to send JSON with `Content-Type: application/json`.

### Sending the Request

```typescript
const request = new CreateExpenseRequest()

const response = await request.setBody({
    title: 'Office supplies',
    amount: 42
}).send()

const body = response.getBody() // Type: CreateExpenseResponseBody
```

Note: If you use Laravel or an API that wraps payloads under a `data` key, consider using `JsonBaseRequest` from the Laravel integration.
