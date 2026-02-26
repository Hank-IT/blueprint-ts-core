# Page-Aware Pagination

Use `PageAwarePaginator` for classic page/size pagination. It requires a view driver factory:

```typescript
import { PageAwarePaginator, ArrayDriver, type ViewDriverFactoryContract } from '@blueprint-ts/core/pagination'

class MyViewDriverFactory implements ViewDriverFactoryContract {
    public make<ResourceInterface>(pageNumber: number, pageSize: number) {
        // Return a ViewDriverContract<ResourceInterface[]> implementation.
        throw new Error('Not implemented')
    }
}

PageAwarePaginator.setViewDriverFactory(new MyViewDriverFactory())

const dataDriver = new ArrayDriver(users)
const paginator = new PageAwarePaginator(dataDriver, 1, 10)

await paginator.load()

const pageData = paginator.getPageData()
const total = paginator.getTotal()
const pages = paginator.getPages()
```

`dataDriver` must implement `PaginationDataDriverContract` and return a `PaginationDataDto`.
If you are using Vue, the library provides `VuePaginationDriverFactory`.

## Changing Page or Page Size

`setPageNumber()` and `setPageSize()` only update state. Call `load()` to fetch data:

```typescript
await paginator.setPageNumber(2).load()

await paginator.setPageSize(25).load()
```

Page navigation helpers (`toNextPage`, `toPreviousPage`, `toFirstPage`, `toLastPage`) update the page number and load
the new page in one call.


## Updating Rows

`updateRows` is available on all paginators. See [Updating Rows](./updating-rows) for details.
