import { describe, it, expect } from 'vitest';
import { PaginationDataDto } from '../../../../src/pagination'

describe('PaginationDataDto', () => {
  interface MockResource {
    id: number;
    name: string;
  }

  it('should correctly store and retrieve data', () => {
    const mockData: MockResource = { id: 1, name: 'Test' };
    const mockTotal = 100;

    const paginationData = new PaginationDataDto(mockData, mockTotal);

    // Test getData method
    expect(paginationData.getData()).toEqual(mockData);

    // Test getTotal method
    expect(paginationData.getTotal()).toBe(mockTotal);
  });

  it('should handle empty or null data', () => {
    const emptyMockData = null;
    const total = 0;

    const paginationData = new PaginationDataDto(emptyMockData, total);

    // Test getData method
    expect(paginationData.getData()).toBeNull();

    // Test getTotal method
    expect(paginationData.getTotal()).toBe(0);
  });
});