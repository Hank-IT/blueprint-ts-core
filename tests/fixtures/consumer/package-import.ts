import {
  BaseRequest,
  JsonResponse,
  JsonBodyFactory,
  RequestMethodEnum,
  XMLHttpRequestDriver,
  RequestContext,
  createRequestContextKey,
  RequestEvents,
  RequestClient,
  createMockRequestScope,
  deferredResponse
} from '@blueprint-ts/core/requests'
import { BaseForm } from '@blueprint-ts/core/vue/forms'
import { PreconditionRequiredException, ResponseBodyException } from '@blueprint-ts/core/requests/exceptions'
import { BulkRequestSender, BulkRequestWrapper } from '@blueprint-ts/core/bulkRequests'

interface State {
  name: string
}
interface Context {
  revision: string
}
const key = createRequestContextKey<Context>('editor')
class Update extends BaseRequest<boolean, object, State, JsonResponse<State>, State> {
  public method() {
    return RequestMethodEnum.PATCH
  }
  public url() {
    return '/resource'
  }
  public getResponse() {
    return new JsonResponse<State>()
  }
  public override getRequestBodyFactory() {
    return new JsonBodyFactory<State>()
  }
}
class Editor extends BaseForm<State, State> {
  public constructor() {
    super({ name: 'loaded' })
  }
}

const client = new RequestClient({ baseUrl: 'https://example.test' })
BaseRequest.setDefaultClient(client)
const unsubscribe = client.on(RequestEvents.BEFORE_SERIALIZE, (request, preparation) => {
  const context = request.context.require(key)
  preparation.headers['If-Match'] = context.revision
  // @ts-expect-error Captured context is read-only.
  context.revision = 'unexpected'
})
const request = new Update()
// @ts-expect-error The typed context key requires a string revision.
new RequestContext().with(key, { revision: 1 })
request.setContext(new RequestContext().with(key, { revision: 'loaded' })).setBody({ name: 'edited' })
request.on(RequestEvents.LOADING, (loading) => {
  const value: boolean = loading
  void value
})
// @ts-expect-error Event arguments are inferred from the event, not chosen by the caller.
request.on(RequestEvents.LOADING, (loading: string) => {
  void loading
})
unsubscribe()
const raw = request.send({ keepalive: true, detached: true, loading: false, globalErrorHandling: false, resolveBody: false })
void raw.then((response) => response.getHeaders())
const typed = request.send({ keepalive: false })
void typed.then((response) => response.getBody().name)
const form = new Editor()
request.setBody(form.buildPayload())
form.acceptSavedValues()
form.acceptSavedValues({ name: 'saved' })
client.on(RequestEvents.RESPONSE_ERROR, (_request, response) => response.getStatusCode() !== 401)
request.on(RequestEvents.RESPONSE_ERROR, async (_request, response) => response.getStatusCode() !== 401)
const batch = new BulkRequestSender([new BulkRequestWrapper(request)]).setScheduling({ keys: () => ['one'] })
void batch.send().then((result) => result.getCancelledCount())
const scope = createMockRequestScope()
const deferred = deferredResponse()
scope.driver.expectAny({ method: RequestMethodEnum.PATCH, url: 'https://example.test/resource' }).respond(deferred.respond)
void XMLHttpRequestDriver
const error: typeof ResponseBodyException = PreconditionRequiredException
void error
