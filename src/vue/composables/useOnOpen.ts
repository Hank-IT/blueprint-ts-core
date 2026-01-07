import { nextTick, type Ref, watch } from 'vue'

type Callback = () => void

export default function (ref: Ref<unknown>) {
  const openCallbacks: Callback[] = []
  const closeCallbacks: Callback[] = []

  watch(
    () => ref.value,
    (newValue, oldValue) => {
      nextTick(() => {
        if (newValue && !oldValue) {
          openCallbacks.forEach((callback) => callback())
        } else if (!newValue && oldValue) {
          closeCallbacks.forEach((callback) => callback())
        }
      })
    }
  )

  function onOpen(callback: Callback): void {
    openCallbacks.push(callback)
  }

  function onClose(callback: Callback): void {
    closeCallbacks.push(callback)
  }

  return {
    onOpen,
    onClose
  }
}
