# Getting Started

Configure one shared `RequestClient` during application startup, before constructing requests. It owns the base URL, transport, default headers and configuration, loader factory, subscriptions, and concurrency state.

<<< ../../examples/v6.ts#startup

Define each endpoint as a request class. Requests capture the default client when constructed. Changing the default affects requests constructed afterward.

<<< ../../examples/v6.ts#request

Send a body with `request.setBody({ name: 'Ada' }).send()`. Use [request context](./request-bodies#request-context) to pass application metadata to lifecycle listeners.

## Explicit clients and scopes

Pass a client to the inherited constructor (`new SaveNameRequest(otherClient)`) or call `request.setClient(otherClient)` before sending. A subclass with its own constructor can accept a client and pass it to `super(client)`. Rebinding during a send throws. Use separate clients for different APIs or isolated tests.

`createRequestScope()` forks the current default client's configuration and listeners, then makes the fresh client the default. The scope owns independent concurrency accounting and cancellation. Call `dispose()` in teardown to abort pending requests without `detached: true` and verify registered mock transports. Default scopes must close in reverse order. `createRequestScope({ client, makeDefault: false })` leaves the default unchanged for independent concurrent clients.

Configure credentials and dynamic headers through the transport driver:

```ts
const client = new RequestClient({
  baseUrl: 'https://api.example.test',
  driver: new FetchDriver({
    corsWithCredentials: true,
    headers: { 'X-XSRF-TOKEN': () => getCookie('XSRF-TOKEN') }
  }),
  loaderFactory: new VueRequestLoaderFactory()
})
BaseRequest.setDefaultClient(client)
```

See [drivers](./drivers), [events](./events), [testing](./testing), and the [Laravel integration](/laravel/requests).
