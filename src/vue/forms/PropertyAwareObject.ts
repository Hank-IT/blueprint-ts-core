/**
 * Opt-in object wrapper for nested property-aware fields.
 * Fields declared as PropertyAwareObject are exposed as nested property-aware
 * children instead of a single scalar field.
 */
export class PropertyAwareObject<T extends object = Record<string, unknown>> {
  [key: string]: unknown
  private readonly __propertyAwareObjectBrand!: void

  public constructor(values: T) {
    void this.__propertyAwareObjectBrand

    Object.assign(this, values)
  }

  public static from<T extends object>(values: T): PropertyAwareObject<T> {
    return new PropertyAwareObject(values)
  }
}
