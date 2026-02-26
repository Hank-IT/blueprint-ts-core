import { describe, test, expect, beforeEach, vi } from 'vitest';
import { PaginationResponse } from '../../../../../src/laravel/requests'

describe('PaginationResponse', () => {
  let paginationResponse: PaginationResponse<{ id: number; name: string }>;

  beforeEach(() => {
    // Erstelle für jeden Test eine neue Instanz
    paginationResponse = new PaginationResponse();
  });

  test('should correctly return total from the response body meta', async () => {
    const mockBody = {
      data: { id: 1, name: 'Test Data' },
      meta: { total: 42 },
    };

    // Simuliere den ResponseHandler mit einem Mock
    const mockResponseHandler = {
      async json() {
        return mockBody;
      },
      getRawResponse: vi.fn(),
      getStatusCode: vi.fn(),
      getHeaders: vi.fn(),
    };

    // Setze die Response und überprüfe getTotal
    await paginationResponse.setResponse(mockResponseHandler as any);

    const total = paginationResponse.getTotal();
    expect(total).toBe(mockBody.meta.total);
  });

  test('should correctly return data from the response body data', async () => {
    const mockBody = {
      data: { id: 1, name: 'Test Data' },
      meta: { total: 42 },
    };

    // Simuliere den ResponseHandler
    const mockResponseHandler = {
      async json() {
        return mockBody;
      },
      getRawResponse: vi.fn(),
      getStatusCode: vi.fn(),
      getHeaders: vi.fn(),
    };

    // Setze die Response und überprüfe die Methode getData
    await paginationResponse.setResponse(mockResponseHandler as any);

    const data = paginationResponse.getData();
    expect(data).toEqual(mockBody.data);
  });

  test('should throw error when body is not set before calling getTotal', () => {
    // Rufe getTotal auf, ohne den Body zu setzen
    expect(() => paginationResponse.getTotal()).toThrowError(
      'Response body is not set'
    );
  });

  test('should throw error when body is not set before calling getData', () => {
    // Rufe getData auf, ohne den Body zu setzen
    expect(() => paginationResponse.getData()).toThrowError(
      'Response body is not set'
    );
  });

  test('should preserve raw response, headers, and status code', async () => {
    const mockBody = {
      data: { id: 3, name: 'Test Headers' },
      meta: { total: 15 },
    };

    const mockRawResponse = { ok: true };
    const mockHeaders = { 'content-type': 'application/json' };
    const mockStatusCode = 200;

    const mockResponseHandler = {
      async json() {
        return mockBody;
      },
      getRawResponse: () => mockRawResponse,
      getStatusCode: () => mockStatusCode,
      getHeaders: () => mockHeaders,
    };

    // Setze die Response
    await paginationResponse.setResponse(mockResponseHandler as any);

    // Prüfe getRawResponse, getHeaders und getStatusCode
    expect(paginationResponse.getData()).toEqual(mockBody.data);
    expect(paginationResponse.getTotal()).toBe(mockBody.meta.total);
    expect(paginationResponse.getRawResponse()).toEqual(mockRawResponse);
    expect(paginationResponse.getHeaders()).toEqual(mockHeaders);
    expect(paginationResponse.getStatusCode()).toBe(mockStatusCode);
  });

  test('should handle responses with no meta data gracefully', async () => {
    const mockBody = {
      data: { id: 1, name: 'Test Data without Meta' },
      meta: null, // Keine meta-Daten
    };

    const mockResponseHandler = {
      async json() {
        return mockBody;
      },
      getRawResponse: vi.fn(),
      getStatusCode: vi.fn(),
      getHeaders: vi.fn(),
    };

    // Setze die Response, auch wenn meta null ist
    await paginationResponse.setResponse(mockResponseHandler as any);

    const data = paginationResponse.getData();
    expect(data).toEqual(mockBody.data);

    expect(() => paginationResponse.getTotal()).toThrowError(
      "Cannot read properties of null (reading 'total')"
    );
  });
});
