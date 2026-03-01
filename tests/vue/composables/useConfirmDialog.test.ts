import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import useConfirmDialog, { ConfirmDialogSeverity, type ConfirmDialogOptions } from '../../../src/vue/composables/useConfirmDialog'

const options: ConfirmDialogOptions = {
  getMessage: () => 'Are you sure?',
  getSeverity: () => ConfirmDialogSeverity.INFO,
  getTitle: () => 'Confirm',
  getOkText: () => 'OK',
  getCancelText: () => 'Cancel',
}

describe('useConfirmDialog', () => {
  it('throws when called outside setup', async () => {
    const Dialog = defineComponent({ setup: () => () => h('div') })
    const { openConfirmDialog } = useConfirmDialog(Dialog, '#dialog')

    await expect(openConfirmDialog(options)).rejects.toThrow('useConfirmDialog must be called inside a setup function')
  })

  it('opens dialog and returns exposed result', async () => {
    const dialogTarget = document.createElement('div')
    dialogTarget.id = 'dialog'
    document.body.appendChild(dialogTarget)

    const Dialog = defineComponent({
      setup(_, { expose }) {
        expose({ open: Promise.resolve(true) })
        return () => h('div')
      },
    })

    let openConfirmDialog: (opts: ConfirmDialogOptions) => Promise<boolean>

    const App = defineComponent({
      setup() {
        ;({ openConfirmDialog } = useConfirmDialog(Dialog, '#dialog'))
        return () => h('div')
      },
    })

    const root = document.createElement('div')
    document.body.appendChild(root)

    createApp(App).mount(root)

    await expect(openConfirmDialog(options)).resolves.toBe(true)
  })

  it('throws when dialog does not expose open', async () => {
    const dialogTarget = document.createElement('div')
    dialogTarget.id = 'dialog-2'
    document.body.appendChild(dialogTarget)

    const Dialog = defineComponent({
      setup() {
        return () => h('div')
      },
    })

    let openConfirmDialog: (opts: ConfirmDialogOptions) => Promise<boolean>

    const App = defineComponent({
      setup() {
        ;({ openConfirmDialog } = useConfirmDialog(Dialog, '#dialog-2'))
        return () => h('div')
      },
    })

    const root = document.createElement('div')
    document.body.appendChild(root)

    createApp(App).mount(root)

    await expect(openConfirmDialog(options)).rejects.toThrow('Provided component does not expose an "open" method')
  })
})
