import { describe, test, expect, beforeEach, vi } from 'vitest';
import { JsonResponse } from '../../../../../src/laravel/requests'

describe('JsonResponse', () => {
  let jsonResponse: JsonResponse<any>; // Generische Instanz für flexibles Testen

  beforeEach(() => {
    jsonResponse = new JsonResponse();
  });

  test('should correctly return data from response body', async () => {
    const mockBody = {
      data: { id: 1, name: 'Test Resource' },
    };

    // Simuliere die Methode `setResponse` mit einem Mock-ResponseHandler
    const mockResponseHandler = {
      async json() {
        return mockBody;
      },
      getRawResponse: vi.fn(),
      getStatusCode: vi.fn(),
      getHeaders: vi.fn(),
    };

    await jsonResponse.setResponse(mockResponseHandler as any);

    // Rufe die Methode `getData` auf und erwarte die korrekten Daten
    const data = jsonResponse.getData();
    expect(data).toEqual(mockBody.data);
  });

  test('should throw error if body is not set before calling getData', () => {
    // Direkt getData aufrufen ohne vorher einen Response-Body zu setzen
    expect(() => jsonResponse.getData()).toThrowError('Response body is not set');
  });

  test('should correctly handle nested resource data', async () => {
    const mockBody = {
      data: { id: 42, attributes: { title: 'Nested Test' } },
    };

    // Simuliere die Methode `setResponse` mit einem Mock-ResponseHandler
    const mockResponseHandler = {
      async json() {
        return mockBody;
      },
      getRawResponse: vi.fn(),
      getStatusCode: vi.fn(),
      getHeaders: vi.fn(),
    };

    await jsonResponse.setResponse(mockResponseHandler as any);

    // Rufe die Methode `getData` auf und überprüfe, ob die geschachtelten Daten korrekt verarbeitet werden
    const data = jsonResponse.getData();
    expect(data).toEqual(mockBody.data);
  });
});
