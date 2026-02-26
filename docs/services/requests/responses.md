# Responses

Requests return a response class that controls the `Accept` header and how the body is parsed.

## JsonResponse

Use `JsonResponse<T>` for JSON APIs. It sets `Accept: application/json` and parses the body with `response.json()`:

```typescript
import { JsonResponse } from '@blueprint-ts/core/requests'

// In your request generic parameters:
// JsonResponse<ExpenseIndexRequestResponseBody>
```

## PlainTextResponse

Use `PlainTextResponse` for endpoints that return plain text. It sets `Accept: text/plain` and parses the body with
`response.text()`:

```typescript
import { PlainTextResponse } from '@blueprint-ts/core/requests'
```

## BlobResponse

Use `BlobResponse` for binary responses like files. It sets `Accept` to the provided MIME type (default
`application/octet-stream`) and parses the body with `response.blob()`:

```typescript
import { BlobResponse } from '@blueprint-ts/core/requests'

const response = new BlobResponse('application/pdf')
```
