import { describe, test, expect, beforeEach } from 'vitest';
import { JsonBaseRequest } from '../../../../src/laravel/requests'
import { JsonResponse } from '../../../../src/laravel/requests'
import { JsonBodyFactory } from '../../../../src/service/requests'

interface TestResource {
  id: number;
  name: string;
}

class TestJsonBaseRequest extends JsonBaseRequest<TestResource> {
  // Abstrakte Klasse muss hier für Tests konkretisiert werden
}

describe('JsonBaseRequest', () => {
  let request: TestJsonBaseRequest;

  beforeEach(() => {
    // Instanziiere die Testklasse vor jedem Test
    request = new TestJsonBaseRequest();
  });

  test('should return a JsonResponse instance from getResponse', () => {
    const response = request.getResponse();
    // Überprüfe, ob getResponse eine JsonResponse-Instanz zurückgibt
    expect(response).toBeInstanceOf(JsonResponse);
  });

  test('should return a JsonBodyFactory instance from getRequestBodyFactory', () => {
    const bodyFactory = request.getRequestBodyFactory();
    // Überprüfe, ob getRequestBodyFactory eine JsonBodyFactory-Instanz zurückgibt
    expect(bodyFactory).toBeInstanceOf(JsonBodyFactory);
  });

  test('should handle generic type definitions for JsonResponse and factory', () => {
    // Testen des generischen Typsystems
    const response = request.getResponse();
    const bodyFactory = request.getRequestBodyFactory();

    expect(response).toBeInstanceOf(JsonResponse<TestResource>);
    expect(bodyFactory).toBeInstanceOf(JsonBodyFactory);
  });
});
