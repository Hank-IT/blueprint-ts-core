import { getCurrentInstance, h, onUnmounted, render } from 'vue'
import { type Component } from 'vue'

export enum ConfirmDialogSeverity {
  INFO = 'info',
  WARNING = 'warning',
  DANGER = 'danger'
}

export interface ConfirmDialogOptions {
  getMessage(): string

  getSeverity(): ConfirmDialogSeverity

  getTitle(): string

  getOkText(): string

  getCancelText(): string
}

/**
 * The provided component needs to expose an "open" method, which
 * should return a promise resolving into true or false.
 */
export default function (confirmDialogComponent: Component, querySelector: string = 'body') {
  const self = getCurrentInstance()

  /**
   * https://stackoverflow.com/a/78448128
   */
  function mountConfirmDialog(options: ConfirmDialogOptions) {
    if (!self?.appContext) {
      throw new Error('ConfirmationDialog: useConfirmDialog must be called inside a setup function')
    }

    const vNode = h(confirmDialogComponent, { options })
    vNode.key = Symbol()
    vNode.appContext = self.appContext
    render(vNode, document.querySelector(querySelector) as Element)
    return vNode.component
  }

  function unmountConfirmDialog() {
    render(null, document.querySelector(querySelector) as Element)
  }

  onUnmounted(() => {
    unmountConfirmDialog()
  })

  async function openConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
    const dialogComponent = mountConfirmDialog(options)

    if (dialogComponent?.exposed == undefined || dialogComponent?.exposed['open'] === undefined) {
      throw new Error('ConfirmationDialog: Provided component does not expose an "open" method')
    }

    return dialogComponent?.exposed['open']
  }

  return { openConfirmDialog }
}
