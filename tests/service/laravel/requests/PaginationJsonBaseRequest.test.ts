import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PaginationJsonBaseRequest } from '../../../../src/laravel/requests'
import { PaginationResponse } from '../../../../src/laravel/requests'

interface TestResource {
  id: number;
  name: string;
}

interface TestRequestParams {
  page_number: number;
  page_size: number;
}

class TestPaginationJsonBaseRequest extends PaginationJsonBaseRequest<TestResource, TestRequestParams> {
  // Abstrakte Klasse für Tests konkretisiert
}

describe('PaginationJsonBaseRequest', () => {
  let request: TestPaginationJsonBaseRequest;

  beforeEach(() => {
    // Instanziiere die Testklasse vor jedem Test
    request = new TestPaginationJsonBaseRequest();
  });

  test('should return a PaginationResponse instance from getResponse', () => {
    const response = request.getResponse();
    // Überprüfe, ob getResponse eine PaginationResponse-Instanz zurückgibt
    expect(response).toBeInstanceOf(PaginationResponse);
  });

  test('should correctly set pagination parameters with setPaginationParams', () => {
    const page = 2;
    const size = 50;

    // Mock der `withParams`-Methode, falls sie von `BaseRequest` stammt
    const mockWithParams = vi.spyOn(request, 'withParams');

    // Rufe `setPaginationParams` auf
    const updatedRequest = request.setPaginationParams(page, size);

    expect(updatedRequest).toBe(request); // Überprüft die fluente API
    expect(mockWithParams).toHaveBeenCalledWith({
      page_number: page,
      page_size: size,
    });

    // Aufräumen von Mocks
    mockWithParams.mockRestore();
  });

  test('should handle generic type definitions for getResponse', () => {
    // Testen des generischen Typsystems
    const response = request.getResponse();
    expect(response).toBeInstanceOf(PaginationResponse<TestResource>);
  });
});
