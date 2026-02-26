# Pagination

Pagination is built around three parts:

1. **Data drivers** fetch pages and return a `PaginationDataDto`.
2. **View drivers** store pagination state (page, size, total) and expose page data.
3. **Paginators** orchestrate loading and state updates.

## Drivers

Pagination uses two kinds of drivers:

- **Data drivers** fetch pages and return a `PaginationDataDto`.
- **View drivers** store pagination state (page, size, total) and expose page data.

You can implement your own drivers by following these contracts:

- `PaginationDataDriverContract` or `StatePaginationDataDriverContract` for data drivers
- `ViewDriverFactoryContract` or `BaseViewDriverFactoryContract` for view drivers

If you are using Vue, the library provides `VuePaginationDriverFactory` and `VueBaseViewDriverFactory`.

### Built-in Data Drivers

- `ArrayDriver`: paginate an in-memory array.
- `RequestDriver`: paginate using a request. See the Laravel pagination integration for usage details.

## Paginators

- [Page-Aware Pagination](./page-aware)
- [Infinite Scroll](./infinite-scroller)
- [State/Cursor Pagination](./state-pagination)

## Load Options

`load()` accepts `PaginatorLoadDataOptions`:

- `flush`: clears existing data before applying the next page
- `replace`: replaces existing data instead of appending (useful for infinite scroll)

`updateRows` is available on all paginators. See [Updating Rows](./updating-rows).

## Using Laravel Pagination

If you use Laravel pagination responses, see the Laravel pagination docs for the `PaginationJsonBaseRequest` and
`RequestDriver` integration.
