import { type WritableComputedRef } from 'vue'

/**
 * Repräsentiert eine reaktive Property mit model.value Zugriff
 */
export interface PropertyAwareField<T> {
  model: WritableComputedRef<T>
  errors: any[]
  suggestions: any[]
  dirty: boolean
}

/**
 * Wandelt ein reguläres Interface in ein property-aware Interface um
 * Jedes Feld vom Typ T wird zu einem PropertyAwareField<T>
 */
export type PropertyAware<T> = {
  [K in keyof T]: PropertyAwareField<T[K]>
}
/**
 * Extends Array with property awareness.
 * When a form field is defined as an instance of PropertyAwareArray,
 * the BaseForm will transform each element into reactive properties with
 * computed getters/setters, error/suggestion tracking, and dirty flags.
 */
export class PropertyAwareArray<T = any> extends Array<T> {
  /**
   * Creates a new PropertyAwareArray instance
   */
  public constructor(items: T[] = []) {
    // Call Array constructor with array length
    super()

    // Add items to the array
    if (items && items.length) {
      items.forEach((item) => this.push(item))
    }
  }

  /**
   * Create a PropertyAwareArray from an existing array
   */
  public static override from<T>(arrayLike: ArrayLike<T>): PropertyAwareArray<T> {
    return new PropertyAwareArray(Array.from(arrayLike))
  }

  /**
   * Maps each element using the provided function
   * Overridden to ensure the return type is PropertyAwareArray<U> rather than Array<U>
   */
  public override map<U>(callbackfn: (value: T, index: number, array: T[]) => U): PropertyAwareArray<U> {
    return new PropertyAwareArray(super.map(callbackfn))
  }

  /**
   * Filters elements using the provided function
   * Overridden to ensure the return type is PropertyAwareArray<T> rather than Array<T>
   */
  public override filter(predicate: (value: T, index: number, array: T[]) => boolean): PropertyAwareArray<T> {
    return new PropertyAwareArray(super.filter(predicate))
  }

  /**
   * Returns a shallow copy of the array
   * Overridden to ensure the return type is PropertyAwareArray<T> rather than Array<T>
   */
  public override slice(start?: number, end?: number): PropertyAwareArray<T> {
    return new PropertyAwareArray(super.slice(start, end))
  }

  /**
   * Combines two or more arrays
   * Overridden to ensure the return type is PropertyAwareArray<T> rather than Array<T>
   */
  public override concat(...items: (T | ConcatArray<T>)[]): PropertyAwareArray<T> {
    return new PropertyAwareArray(super.concat(...items))
  }
}
