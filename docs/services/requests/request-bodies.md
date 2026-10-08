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

## Body snapshots

Each send snapshots supported values before preparation listeners and serialization. Plain objects, arrays, dates, regular expressions, maps, sets, buffers, typed-array views, `URL`, and `URLSearchParams` are copied. `FormData` entries are copied, preserving duplicate names and files; immutable `Blob` and `File` values retain their identity.

Custom class instances and functions retain their identity, including when nested in a plain object. Their factories and `toJSON()` methods can use private fields and native methods. Changes to those retained objects are visible during asynchronous preparation; supply separate instances when an operation needs isolated values.

## JSON Bodies

Use `JsonBodyFactory` to send JSON and set `Content-Type: application/json`:

```typescript
import { BaseRequest, JsonBodyFactory, RequestMethodEnum } from '@blueprint-ts/core/requests'

class CreateExpenseRequest extends BaseRequest<
  boolean,
  GenericResponseErrorInterface,
  ExpenseResource,
  JsonResponse<ExpenseResource>,
  CreateExpensePayload
> {
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
import { FormDataFactory } from '@blueprint-ts/core/requests'

public override getRequestBodyFactory() {
    return new FormDataFactory<FormPayload>()
}
```

If you want to show upload progress for multipart file uploads, see [File Uploads](/services/requests/file-uploads).

## Raw Binary Bodies

Use `BinaryBodyFactory` when the request body should be sent as raw binary instead of multipart form data. This is a
better fit for chunk uploads, binary artifact pushes, and endpoints that expect the request body as-is:

```typescript
import { BinaryBodyFactory } from '@blueprint-ts/core/requests'

public override getRequestBodyFactory() {
    return new BinaryBodyFactory<ArrayBuffer>('application/octet-stream')
}
```

`BinaryBodyFactory` supports:

- `Blob`
- `ArrayBuffer`
- typed-array and view values such as `Uint8Array` or `DataView`

`Content-Type` resolution works like this:

- If you pass a content type to `BinaryBodyFactory`, Blueprint sends that `Content-Type` header.
- Otherwise, if the body is a `Blob` with a non-empty `type`, Blueprint uses `Blob.type`.
- Otherwise, Blueprint does not add a `Content-Type` header for you.

`BinaryBodyFactory` works with both `FetchDriver` and `XMLHttpRequestDriver`. Choose `XMLHttpRequestDriver` only when
the consuming application needs upload progress events.

## Custom Body Factories

You can implement your own body factory by returning a `BodyContract` with custom headers and serialization logic.

## Request context

Use `setContext()` to provide typed application metadata to request lifecycle listeners. Context is independent of the body set by `setBody()` and is not serialized automatically.

For example, an application can define a request ID key and map it to a header in its client:

<<< ../../examples/v6.ts#startup

Attach that context to a request:

<<< ../../examples/v6.ts#context

`getContext()` returns the request's context. `setBody()` replaces the body without changing it. To clear context on a reused request, call `setContext(new RequestContext())`.

Context values support plain objects, arrays, and primitives, and are copied and frozen. Create typed keys with `createRequestContextKey<T>()`, then read values through `context.get(key)` or `context.require(key)`.

Each send captures its context and snapshots its body before preparation. Plain objects, arrays, buffers, and views are copied; immutable Blob/File values preserve bytes, and FormData preserves entries, duplicate keys, and files.
