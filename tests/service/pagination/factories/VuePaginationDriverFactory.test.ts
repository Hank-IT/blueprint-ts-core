import { describe, it, expect } from 'vitest';
import { VuePaginationDriverFactory } from '../../../../src/pagination'
import { VuePaginationDriver } from '../../../../src/pagination'

describe('VuePaginationDriverFactory', () => {
  it('should create an instance of VuePaginationDriver', () => {
    const factory = new VuePaginationDriverFactory();

    const pageNumber = 1;
    const pageSize = 10;

    const driver = factory.make(pageNumber, pageSize);

    // Test if the returned object is an instance of VuePaginationDriver
    expect(driver).toBeInstanceOf(VuePaginationDriver);
  });

  it('should correctly pass pageNumber and pageSize to VuePaginationDriver', () => {
    const factory = new VuePaginationDriverFactory();

    const pageNumber = 3;
    const pageSize = 20;

    const driver = factory.make(pageNumber, pageSize);

    // Cast to VuePaginationDriver to access its properties (falls nötig)
    const vueDriver = driver as VuePaginationDriver<unknown[]>;

    expect(vueDriver.getCurrentPage()).toBe(pageNumber);
    expect(vueDriver.getPageSize()).toBe(pageSize);
  });
});