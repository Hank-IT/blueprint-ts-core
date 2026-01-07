import { ref, computed, type Ref, type WritableComputedRef } from 'vue'

export default function (
  callback: (value: boolean) => void = () => {},
  delay: number = 500
): {
  isOpenKey: Ref<number>
  isOpen: WritableComputedRef<boolean>
} {
  const internalIsOpen = ref<boolean>(false)

  const isOpenKey = ref<number>(0)

  const isOpen = computed({
    get(): boolean {
      return internalIsOpen.value
    },
    set(value: boolean): void {
      // False means we close, so we increment the key
      // Add delay to preserve the closing animation.
      setTimeout(() => {
        if (!value) {
          isOpenKey.value++
        }
      }, delay)

      internalIsOpen.value = value

      callback(value)
    }
  })

  return {
    isOpenKey,
    isOpen
  }
}
