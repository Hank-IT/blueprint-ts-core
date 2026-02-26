import { describe, it, expect } from 'vitest';
import { VuePaginationDriver } from '../../../../src/pagination'

describe('VuePaginationDriver', () => {
  it('should initialize with correct default values', () => {
    const pageNumber = 1;
    const pageSize = 10;
    const driver = new VuePaginationDriver(pageNumber, pageSize);

    expect(driver.getData()).toEqual([]);
    expect(driver.getCurrentPage()).toBe(pageNumber);
    expect(driver.getPageSize()).toBe(pageSize);
    expect(driver.getTotal()).toBe(0);
    expect(driver.getLastPage()).toBe(0);
    expect(driver.getPages()).toEqual([]);
  });

  it('should set and get data correctly', () => {
    const driver = new VuePaginationDriver(1, 10);

    const data = [{ id: 1 }, { id: 2 }];
    driver.setData(data);

    expect(driver.getData()).toEqual(data);
  });

  it('should set and get total correctly', () => {
    const driver = new VuePaginationDriver(1, 10);

    driver.setTotal(100);

    expect(driver.getTotal()).toBe(100);
    expect(driver.getLastPage()).toBe(10); // 100 items, 10 items per page
    expect(driver.getPages()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('should update current page correctly', () => {
    const driver = new VuePaginationDriver(1, 10);

    driver.setPage(5);
    expect(driver.getCurrentPage()).toBe(5);
  });

  it('should update page size correctly', () => {
    const driver = new VuePaginationDriver(1, 10);

    driver.setPageSize(20);
    expect(driver.getPageSize()).toBe(20);

    driver.setTotal(100);
    expect(driver.getLastPage()).toBe(5); // 100 items, 20 items per page
    expect(driver.getPages()).toEqual([1, 2, 3, 4, 5]);
  });

  it('should compute correct pagination values when data changes', () => {
    const driver = new VuePaginationDriver(1, 10);

    driver.setTotal(35); // 35 items, 10 items per page
    expect(driver.getLastPage()).toBe(4);
    expect(driver.getPages()).toEqual([1, 2, 3, 4]);

    driver.setPageSize(7); // Change page size
    expect(driver.getLastPage()).toBe(5); // 35 items, 7 items per page
    expect(driver.getPages()).toEqual([1, 2, 3, 4, 5]);
  });
});