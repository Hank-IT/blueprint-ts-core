import { type PersistenceDriver } from './types/PersistenceDriver'

/** Default driver: does not persist any data. */
export class NonPersistentDriver implements PersistenceDriver {
  get(): null {
    return null
  }

  set(): void {}

  remove(): void {}
}
