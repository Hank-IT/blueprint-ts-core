# Request Bodies

Request body factories control how outgoing request bodies are serialized and which `Content-Type` header is sent.
They are separate from response parsing (response classes control `Accept` and how the response body is parsed).

## How It Works

When you call `send()`, `BaseRequest` uses the request body factory to build a `BodyContract`:

- `getRequestBodyFactory()` returns a `BodyFactoryContract`
- `BodyFactoryContract.make()` returns a `BodyContract`
- `BodyContract.getHeaders()` provides headers (like `Content-Type`)
- `BodyContract.getContent()` provides the serialized body

If you call `setBody(...)` without providing a body factory, the body is not sent.

## JSON Bodies

Use `JsonBodyFactory` to send JSON and set `Content-Type: application/json`:

```typescript
import { BaseRequest, JsonBodyFactory, RequestMethodEnum } from '@blueprint-ts/core/service/requests'

class CreateExpenseRequest extends BaseRequest<boolean, GenericResponseErrorInterface, ExpenseResource, JsonResponse<ExpenseResource>, CreateExpensePayload> {
    public method(): RequestMethodEnum {
        return RequestMethodEnum.POST
    }

    public url(): string {
        return '/api/v1/expenses'
    }

    public getResponse(): JsonResponse<ExpenseResource> {
        return new JsonResponse<ExpenseResource>()
    }

    public override getRequestBodyFactory() {
        return new JsonBodyFactory<CreateExpensePayload>()
    }
}
```

If you are using the Laravel integration, `JsonBaseRequest` already configures the JSON body factory for you.

## FormData Bodies

Use `FormDataFactory` for multipart requests (uploads, mixed fields):

```typescript
import { FormDataFactory } from '@blueprint-ts/core/service/requests'

public override getRequestBodyFactory() {
    return new FormDataFactory<FormPayload>()
}
```

## Custom Body Factories

You can implement your own body factory by returning a `BodyContract` with custom headers and serialization logic.
