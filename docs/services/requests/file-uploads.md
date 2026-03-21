# File Uploads

Use `FormDataFactory` to build multipart payloads, and use `XMLHttpRequestDriver` when the consuming application needs
upload progress for a progress bar.

## Request Definition

```typescript
import {
    BaseRequest,
    FormDataFactory,
    JsonResponse,
    RequestMethodEnum,
    XMLHttpRequestDriver
} from '@blueprint-ts/core/requests'

interface UploadAvatarPayload {
    avatar: File
}

interface UploadAvatarResponse {
    id: string
    url: string
}

class UploadAvatarRequest extends BaseRequest<
        boolean,
        { message: string },
        UploadAvatarResponse,
        JsonResponse<UploadAvatarResponse>,
        UploadAvatarPayload
> {
    public method(): RequestMethodEnum {
        return RequestMethodEnum.POST
    }

    public url(): string {
        return '/api/v1/avatar'
    }

    public getResponse(): JsonResponse<UploadAvatarResponse> {
        return new JsonResponse<UploadAvatarResponse>()
    }

    public override getRequestBodyFactory() {
        return new FormDataFactory<UploadAvatarPayload>()
    }

    protected override getRequestDriver() {
        return new XMLHttpRequestDriver({
            corsWithCredentials: true,
            headers: {
                'X-XSRF-TOKEN': () => getCookie('XSRF-TOKEN')
            }
        })
    }
}
```

## Global Default Driver

You can keep `FetchDriver` as the application default. The upload request above will still use `XMLHttpRequestDriver`
because it defines its own driver internally:

```typescript
import { BaseRequest, FetchDriver } from '@blueprint-ts/core/requests'

BaseRequest.setRequestDriver(new FetchDriver())
```

Important: the upload request's `XMLHttpRequestDriver` does not inherit config from the global `FetchDriver`. If the
upload request needs credentials or shared headers, define them on the `XMLHttpRequestDriver` returned by
`getRequestDriver()`.

## Listening for Upload Progress

```typescript
import { RequestEvents, type RequestUploadProgress } from '@blueprint-ts/core/requests'

const request = new UploadAvatarRequest()

request.on<RequestUploadProgress>(RequestEvents.UPLOAD_PROGRESS, (progress) => {
    if (!progress.lengthComputable || progress.progress === undefined) {
        return
    }

    progressBar.value = progress.progress * 100
})

await request.setBody({
    avatar: fileInput.files![0],
}).send()
```

## Notes

- Upload progress requires `XMLHttpRequestDriver`. The default `FetchDriver` does not emit upload progress events.
- Define `XMLHttpRequestDriver` inside the upload request class when that request should always support progress.
- `XMLHttpRequestDriver` supports the same `corsWithCredentials` and `headers` options as `FetchDriver`, including
  header callbacks.
- Request-defined drivers do not automatically inherit config from the globally registered driver.
- Some browsers cannot compute a reliable total size for every upload. Check `lengthComputable` before rendering a
  percentage.
- Upload event listeners may cause CORS preflight requests on cross-origin uploads. Ensure the server is configured
  accordingly.
