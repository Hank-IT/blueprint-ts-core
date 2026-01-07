/**
 * A new instance of deferred is constructed by calling `new DeferredPromse<T>()`.
 * The purpose of the deferred object is to expose the associated Promise
 * instance APIs that can be used for signaling the successful
 * or unsuccessful completion, as well as the state of the task.
 * @export
 * @class DeferredPromise
 * @implements {Promise<T>}
 * @template T
 * @example
 * const deferred = new DeferredPromse<string>();
 * console.log(deferred.state); // 'pending'
 *
 * deferred
 * .then(str => console.log(str))
 * .catch(err => console.error(err));
 *
 * deferred.resolve('Foo');
 * console.log(deferred.state); // 'fulfilled'
 * // deferred.reject('Bar');
 *
 * https://gist.github.com/GFoley83/5877f6c09fbcfd62569c51dc91444cf0
 */
export class DeferredPromise<T> implements Promise<T> {
  readonly [Symbol.toStringTag]: 'Promise' = 'Promise'

  private _promise: Promise<T>
  private _resolve!: (value: T | PromiseLike<T>) => void
  private _reject!: (reason?: unknown) => void
  private _state: 'pending' | 'fulfilled' | 'rejected' = 'pending'

  public get state(): 'pending' | 'fulfilled' | 'rejected' {
    return this._state
  }

  public constructor() {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject
    })
  }

  public then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._promise.then(onfulfilled, onrejected)
  }

  public catch<TResult = never>(onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null): Promise<T | TResult> {
    return this._promise.catch(onrejected)
  }

  public finally(onfinally?: (() => void) | null): Promise<T> {
    return this._promise.finally(onfinally)
  }

  public resolve(value: T | PromiseLike<T>): void {
    this._resolve(value)
    this._state = 'fulfilled'
  }

  public reject(reason?: unknown): void {
    this._reject(reason)
    this._state = 'rejected'
  }
}
