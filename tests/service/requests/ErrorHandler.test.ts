import { describe, it, expect, vi } from 'vitest';
import { ErrorHandler } from '../../../src/requests'

import {
  PageExpiredException,
  NotFoundException,
  UnauthorizedException,
  ValidationException,
  ResponseException,
  NoResponseReceivedException,
  ServerErrorException
} from '../../../src/requests/exceptions';

describe('ErrorHandler', () => {
  it('should throw UnauthorizedException for status code 401', () => {
    // Mock-response that mimics a ResponseHandlerContract
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(401),
    };

    // Mock the ResponseException with the mocked response
    const mockError = {
      getResponse: vi.fn().mockReturnValue(mockResponse),
    };

    expect(() => new ErrorHandler(mockError as any)).toThrow(UnauthorizedException);

    // Assert that methods were called
    expect(mockError.getResponse).toHaveBeenCalled();
    expect(mockResponse.getStatusCode).toHaveBeenCalled();
  });

  it('should throw NotFoundException for status code 404', () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(404),
    };

    const mockError = {
      getResponse: vi.fn().mockReturnValue(mockResponse),
    };

    expect(() => new ErrorHandler(mockError as any)).toThrow(NotFoundException);

    expect(mockError.getResponse).toHaveBeenCalled();
    expect(mockResponse.getStatusCode).toHaveBeenCalled();
  });

  it('should throw PageExpiredException for status code 419', () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(419),
    };

    const mockError = {
      getResponse: vi.fn().mockReturnValue(mockResponse),
    };

    expect(() => new ErrorHandler(mockError as any)).toThrow(PageExpiredException);

    expect(mockError.getResponse).toHaveBeenCalled();
    expect(mockResponse.getStatusCode).toHaveBeenCalled();
  });

  it('should throw ValidationException for status code 422', () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(422),
    };

    const mockError = {
      getResponse: vi.fn().mockReturnValue(mockResponse),
    };

    expect(() => new ErrorHandler(mockError as any)).toThrow(ValidationException);

    expect(mockError.getResponse).toHaveBeenCalled();
    expect(mockResponse.getStatusCode).toHaveBeenCalled();
  });

  it('should throw ServerErrorException for status code 500', () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(500),
    };

    const mockError = {
      getResponse: vi.fn().mockReturnValue(mockResponse),
    };

    expect(() => new ErrorHandler(mockError as any)).toThrow(ServerErrorException);

    expect(mockError.getResponse).toHaveBeenCalled();
    expect(mockResponse.getStatusCode).toHaveBeenCalled();
  });

  it('should throw NoResponseReceivedException if no status code in response', () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(undefined),
    };

    const mockError = {
      getResponse: vi.fn().mockReturnValue(mockResponse),
    };

    expect(() => new ErrorHandler(mockError as any)).toThrow(NoResponseReceivedException);

    expect(mockError.getResponse).toHaveBeenCalled();
    expect(mockResponse.getStatusCode).toHaveBeenCalled();
  });

  it('should throw ResponseException for other status codes', () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(499),
    };

    const mockError = {
      getResponse: vi.fn().mockReturnValue(mockResponse),
    };

    expect(() => new ErrorHandler(mockError as any)).toThrow(ResponseException);

    expect(mockError.getResponse).toHaveBeenCalled();
    expect(mockResponse.getStatusCode).toHaveBeenCalled();
  });

  it('should correctly use global error handler if registered', () => {
    // Set up the global handler
    const handlerMock = vi.fn().mockReturnValue(false);
    ErrorHandler.registerHandler(handlerMock);

    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(500),
    };

    const mockError = {
      getResponse: vi.fn().mockReturnValue(mockResponse),
    };

    // Since the handler returns false, the error should not propagate further
    expect(() => new ErrorHandler(mockError as any)).not.toThrow();

    expect(handlerMock).toHaveBeenCalledWith(mockError);
  });
});
