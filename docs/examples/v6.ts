import {
  BaseRequest,
  RequestClient,
  FetchDriver,
  JsonResponse,
  JsonBodyFactory,
  RequestMethodEnum,
  RequestContext,
  RequestEvents,
  createRequestContextKey,
  createMockRequestScope,
  jsonResponse,
  expectJsonBody
} from '@blueprint-ts/core/requests'
import { BaseForm } from '@blueprint-ts/core/vue/forms'

export interface Values {
  name: string
}

// #region startup
export const requestId = createRequestContextKey<string>('request ID')

export function createClient(baseUrl: string): RequestClient {
  const client = new RequestClient({
    baseUrl,
    driver: new FetchDriver({ corsWithCredentials: true }),
    onListenerError: (error, event) => console.error('Request observer failed', event, error)
  })
  client.on(RequestEvents.BEFORE_SERIALIZE, (snapshot, preparation) => {
    const id = snapshot.context.get(requestId)
    if (id !== undefined) preparation.headers['X-Request-Id'] = id
  })
  return client
}

export function startApplication(): void {
  BaseRequest.setDefaultClient(createClient('https://api.example.test'))
}
// #endregion startup

// #region request
export class SaveNameRequest extends BaseRequest<boolean, { message: string }, Values, JsonResponse<Values>, Values> {
  public method() {
    return RequestMethodEnum.PATCH
  }
  public url() {
    return '/profile'
  }
  public getResponse() {
    return new JsonResponse<Values>()
  }
  public override getRequestBodyFactory() {
    return new JsonBodyFactory<Values>()
  }
}
// #endregion request

// #region context
export async function rename(id: string, name: string): Promise<Values> {
  const context = new RequestContext().with(requestId, id)
  return (await new SaveNameRequest().setContext(context).setBody({ name: name.trim() }).send()).getBody()
}
// #endregion context

// #region form
export class NameForm extends BaseForm<Values, Values> {
  public constructor(initialValues: Values) {
    super(initialValues)
  }
}

export async function save(form: NameForm): Promise<void> {
  await new SaveNameRequest().setBody(form.buildPayload()).send()
  form.acceptSavedValues()
}
// #endregion form

// #region localSave
export function saveLocally(form: NameForm): void {
  localStorage.setItem('profile', JSON.stringify(form.buildPayload()))
  form.acceptSavedValues()
}
// #endregion localSave

// #region testing
export async function verifySave(): Promise<void> {
  const scope = createMockRequestScope({ client: createClient('https://api.example.test') })
  try {
    scope.driver
      .expectAny({ method: RequestMethodEnum.PATCH, url: 'https://api.example.test/profile' })
      .withHeaders((headers) => headers['X-Request-Id'] === 'example-request')
      .withBody(expectJsonBody({ name: 'Edited' }))
      .respond(jsonResponse(200, { name: 'Edited' }))
    await rename('example-request', ' Edited ')
  } finally {
    scope.dispose()
  }
}
// #endregion testing
