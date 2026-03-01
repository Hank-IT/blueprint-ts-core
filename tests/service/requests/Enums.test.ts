import { describe, expect, it } from 'vitest'
import { RequestMethodEnum } from '../../../src/requests/RequestMethod.enum'
import { RequestEvents } from '../../../src/requests/RequestEvents.enum'
import { RequestConcurrencyMode } from '../../../src/requests/RequestConcurrencyMode.enum'
import { BulkRequestExecutionMode } from '../../../src/bulkRequests/BulkRequestSender'


describe('Enums', () => {
  it('exposes expected request enums', () => {
    expect(RequestMethodEnum.GET).toBe('GET')
    expect(RequestEvents.LOADING).toBe('loading')
    expect(RequestConcurrencyMode.REPLACE_LATEST).toBe('replace-latest')
  })

  it('exposes bulk request execution modes', () => {
    expect(BulkRequestExecutionMode.PARALLEL).toBe('parallel')
    expect(BulkRequestExecutionMode.SEQUENTIAL).toBe('sequential')
  })
})
