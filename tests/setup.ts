import { afterEach, beforeEach } from 'vitest'
import { createRequestScope, RequestClient } from '../src/requests'

let scope: ReturnType<typeof createRequestScope>
beforeEach(() => {
  scope = createRequestScope({ client: new RequestClient() })
})
afterEach(() => {
  scope.dispose()
})
