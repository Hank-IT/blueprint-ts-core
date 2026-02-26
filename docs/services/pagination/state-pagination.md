# State/Cursor Pagination

Use `StatePaginator` for cursor-based APIs that return a next-state token. It requires a base view driver factory:

```typescript
import { StatePaginator, type BaseViewDriverFactoryContract } from '@blueprint-ts/core/service/pagination'

class MyBaseViewDriverFactory implements BaseViewDriverFactoryContract {
    public make<ResourceInterface>() {
        // Return a BaseViewDriverContract<ResourceInterface[]> implementation.
        throw new Error('Not implemented')
    }
}

StatePaginator.setViewDriverFactory(new MyBaseViewDriverFactory())

const paginator = new StatePaginator(dataDriver)

await paginator.load()
await paginator.loadNext()
```

`dataDriver` must implement `StatePaginationDataDriverContract` and return a `StatePaginationDataDto`.
If you are using Vue, the library provides `VueBaseViewDriverFactory`.

## Example Driver

```typescript
import { type StatePaginationDataDriverContract, StatePaginationDataDto } from '@blueprint-ts/core/service/pagination'
import { type MailListResource } from '@/types/MailListResource.ts'
import { MailIndexRequest, type MailIndexRequestRequestParams } from '@/requests/MailIndexRequest.ts'
import { RequestEvents } from '@blueprint-ts/core/service/requests'

export class MailPaginationDataDriver implements StatePaginationDataDriverContract<MailListResource[]> {
    public constructor(
        protected accountId: string,
        protected filters?: MailIndexRequestRequestParams['filter']
    ) {}

    public get(state?: string | null): Promise<StatePaginationDataDto<MailListResource[]>> {
        const request = new MailIndexRequest(this.accountId)

        request.setParams({
            state: state || undefined,
            filter: this.filters
        })

        return request
            .send()
            .then((response) => {
                const data = response.getData() || []
                const body = response.getBody() as unknown as { meta?: { state?: string; total?: number } }
                const nextState = body.meta?.state || null
                const total = body.meta?.total || data.length

                return new StatePaginationDataDto(data, total, nextState)
            })
    }
}

const paginator = new StatePaginator(new MailPaginationDataDriver(props.accountId))

function loadMails() {
    paginator.flush()
    paginator.load().catch((error) => {
        console.error(error)
    })
}

function loadMoreMails() {
    if (!paginator.hasNextPage()) return

    paginator.loadNext().catch((error) => {
        console.error(error)
    })
}
```
