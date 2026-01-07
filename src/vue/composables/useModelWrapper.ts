import { computed } from 'vue'
import { type ModelValueProps } from '../contracts/ModelValueProps'
import { type ModelValueOptions as ParentModelValueOptions } from '../contracts/ModelValueOptions'

export interface ModelValueOptions<T> extends ParentModelValueOptions {
  callback?: (value: T) => void
}

export default function <T, EmitType>(props: ModelValueProps, emit: EmitType, options: ModelValueOptions<T> = {}) {
  const { name = 'modelValue', callback = () => {} } = options

  return computed({
    get(): T {
      /* @ts-expect-error Ignore type */
      return props[name]
    },
    set(value: T): void {
      /* @ts-expect-error Ignore expression is not callable */
      emit(`update:${name}`, value)

      callback(value)
    }
  })
}
