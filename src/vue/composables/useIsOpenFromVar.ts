import { ref, computed, type Ref, type ComputedRef } from 'vue'
import useIsEmpty from './useIsEmpty'

export default function <FromVarType>(
  defaultValue: FromVarType | undefined = undefined,
  delay: number = 500
): {
  fromVar: ComputedRef<FromVarType | undefined>
  isOpenFromVar: ComputedRef<boolean>
  isOpenFromVarKey: Ref<number>
} {
  const isOpenFromVarKey = ref<number>(0)

  const { isNotEmpty } = useIsEmpty()

  const internalIsOpen = ref<boolean>(false)

  const internalFromVar = ref<FromVarType | undefined>(defaultValue)

  const isOpenFromVar = computed({
    get(): boolean {
      return internalIsOpen.value
    },
    set(value): void {
      if (value) {
        internalIsOpen.value = true

        internalFromVar.value = value
      } else {
        internalIsOpen.value = false

        setTimeout((): void => {
          internalFromVar.value = defaultValue

          isOpenFromVarKey.value++
        }, delay)
      }
    }
  })

  const fromVar = computed({
    get(): FromVarType | undefined {
      return internalFromVar.value
    },
    set(value): void {
      if (isNotEmpty(value)) {
        isOpenFromVar.value = true

        internalFromVar.value = value
      } else {
        isOpenFromVar.value = false
      }
    }
  })

  return {
    fromVar,
    isOpenFromVar,
    isOpenFromVarKey
  }
}
