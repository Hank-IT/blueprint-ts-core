import { type RequestLoaderContract } from './RequestLoaderContract'

export interface RequestLoaderFactoryContract<T> {
  make(): RequestLoaderContract<T>
}
