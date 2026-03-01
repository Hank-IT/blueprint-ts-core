import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler } from '../../../src/requests'

import {
  PageExpiredException,
  NotFoundException,
  UnauthorizedException,
  ValidationException,
  ResponseException,
  NoResponseReceivedException,
  ServerErrorException,
  InvalidJsonException,
  BadRequestException,
  ForbiddenException,
  MethodNotAllowedException,
  RequestTimeoutException,
  ConflictException,
  GoneException,
  PreconditionFailedException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  LockedException,
  TooManyRequestsException,
  NotImplementedException,
  BadGatewayException,
  ServiceUnavailableException,
  GatewayTimeoutException
} from '../../../src/requests/exceptions';

describe('ErrorHandler', () => {
  beforeEach(() => {
    ErrorHandler.registerHandler(undefined);
  });

  it('should throw UnauthorizedException for status code 401', async () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(401),
      json: vi.fn().mockResolvedValue({}),
    };

    const handler = new ErrorHandler(mockResponse as any)

    await expect(handler.handle()).rejects.toThrow(UnauthorizedException);

    expect(mockResponse.getStatusCode).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('should throw NotFoundException for status code 404', async () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(404),
      json: vi.fn().mockResolvedValue({}),
    };

    const handler = new ErrorHandler(mockResponse as any)

    await expect(handler.handle()).rejects.toThrow(NotFoundException);

    expect(mockResponse.getStatusCode).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('should throw PageExpiredException for status code 419', async () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(419),
      json: vi.fn().mockResolvedValue({}),
    };

    const handler = new ErrorHandler(mockResponse as any)

    await expect(handler.handle()).rejects.toThrow(PageExpiredException);

    expect(mockResponse.getStatusCode).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('should throw ValidationException for status code 422', async () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(422),
      json: vi.fn().mockResolvedValue({}),
    };

    const handler = new ErrorHandler(mockResponse as any)

    await expect(handler.handle()).rejects.toThrow(ValidationException);

    expect(mockResponse.getStatusCode).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('should throw ServerErrorException for status code 500', async () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(500),
      json: vi.fn().mockResolvedValue({}),
    };

    const handler = new ErrorHandler(mockResponse as any)

    await expect(handler.handle()).rejects.toThrow(ServerErrorException);

    expect(mockResponse.getStatusCode).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('should throw NoResponseReceivedException if response body is undefined', async () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(undefined),
      json: vi.fn().mockResolvedValue(undefined),
    };

    const handler = new ErrorHandler(mockResponse as any)

    await expect(handler.handle()).rejects.toThrow(NoResponseReceivedException);
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('should throw ResponseException for other status codes', async () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(499),
      json: vi.fn().mockResolvedValue({}),
    };

    const handler = new ErrorHandler(mockResponse as any)

    await expect(handler.handle()).rejects.toThrow(ResponseException);

    expect(mockResponse.getStatusCode).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('should correctly use global error handler if registered', async () => {
    const handlerMock = vi.fn().mockReturnValue(false);
    ErrorHandler.registerHandler(handlerMock);

    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(500),
      json: vi.fn().mockResolvedValue({}),
    };

    const handler = new ErrorHandler(mockResponse as any)

    await expect(handler.handle()).resolves.toBeUndefined();

    expect(handlerMock).toHaveBeenCalledWith(mockResponse);
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it('should throw InvalidJsonException when response parsing fails', async () => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(500),
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
    };

    const handler = new ErrorHandler(mockResponse as any)

    await expect(handler.handle()).rejects.toThrow(InvalidJsonException);
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it.each([
    [400, BadRequestException],
    [403, ForbiddenException],
    [405, MethodNotAllowedException],
    [408, RequestTimeoutException],
    [409, ConflictException],
    [410, GoneException],
    [412, PreconditionFailedException],
    [413, PayloadTooLargeException],
    [415, UnsupportedMediaTypeException],
    [423, LockedException],
    [429, TooManyRequestsException],
    [501, NotImplementedException],
    [502, BadGatewayException],
    [503, ServiceUnavailableException],
    [504, GatewayTimeoutException],
  ])('should throw correct exception for status code %i', async (status, ExceptionType) => {
    const mockResponse = {
      getStatusCode: vi.fn().mockReturnValue(status),
      json: vi.fn().mockResolvedValue({}),
    };

    const handler = new ErrorHandler(mockResponse as any);

    await expect(handler.handle()).rejects.toThrow(ExceptionType);
    expect(mockResponse.getStatusCode).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalled();
  });
});
