import { describe, test, expect, vi, beforeEach } from 'vitest'
import { RequestDriver } from '../../../../../src/laravel/pagination'
import { PaginationDataDto } from '../../../../../src/pagination'
import { PaginationResponse } from '../../../../../src/laravel/requests'

// Mocks für Schnittstellen und Klassen
class MockRequest {
  setPaginationParams = vi.fn().mockReturnThis()
  send = vi.fn()
}

class MockPaginationResponse extends PaginationResponse<any> {
  protected resolveBody = vi.fn().mockResolvedValue(this.mockBody)
  private mockBody

  constructor(data: any[]) {
    super()
    this.mockBody = data
  }

  getTotal() {
    return this.mockBody.length
  }

  getData() {
    return this.mockBody
  }
}

describe('RequestDriver', () => {
  let mockRequest: MockRequest
  let requestDriver: RequestDriver<typeof mockRequest>

  beforeEach(() => {
    mockRequest = new MockRequest()
    requestDriver = new RequestDriver(mockRequest as any)
  })

  test('should call setPaginationParams with correct parameters', async () => {
    const pageNumber = 1
    const pageSize = 10

    // Mock PaginationResponse
    const mockResponse = new MockPaginationResponse([{ id: 1 }, { id: 2 }])

    // Mock send method to resolve to a mock PaginationResponse
    mockRequest.send.mockResolvedValue(mockResponse)
    await requestDriver.get(pageNumber, pageSize)

    expect(mockRequest.setPaginationParams).toHaveBeenCalledWith(
      pageNumber,
      pageSize
    )
  })

  test('should correctly map response to PaginationDataDto', async () => {
    const pageNumber = 1
    const pageSize = 10

    const mockData = [{ id: 1 }, { id: 2 }]
    const mockResponse = new MockPaginationResponse(mockData)

    // Mock send method to resolve to a mock PaginationResponse
    mockRequest.send.mockResolvedValue(mockResponse)

    const result = await requestDriver.get(pageNumber, pageSize)

    expect(result).toBeInstanceOf(PaginationDataDto)
    expect(result.data).toEqual(mockData)
    expect(result.total).toBe(mockData.length)
  })

  test('should handle request errors gracefully', async () => {
    const pageNumber = 1
    const pageSize = 10

    const error = new Error('Request failed')
    mockRequest.send.mockRejectedValue(error)

    await expect(requestDriver.get(pageNumber, pageSize)).rejects.toThrowError(
      'Request failed'
    )
  })
})
