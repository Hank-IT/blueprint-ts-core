import { toRaw } from 'vue'
import type { PersistenceDriver } from '../../../persistenceDrivers/types/PersistenceDriver'
import { cloneFormValue, restorePropertyAwareStructure } from '../internal/formValues'
import type { BaseFormOptions } from '../internal/types'
import type { PersistedForm } from '../types/PersistedForm'
import { isPersistedFormLike } from './StrictPersistenceRestorePolicy'
import type { PersistenceDebugEvent, PersistenceRestorePolicy } from './types'

interface PersistenceAccess<FormBody extends object> {
  formName: string
  options(): BaseFormOptions | undefined
  driver(suffix: string | undefined): PersistenceDriver
  restorePolicy(): PersistenceRestorePolicy<FormBody>
  log(event: PersistenceDebugEvent<FormBody>): void
}

/** Reads and writes drafts while leaving driver and restore-policy selection to the form. */
export class FormPersistence<FormBody extends object> {
  private readonly persistKey: string | undefined

  public constructor(private readonly access: PersistenceAccess<FormBody>) {
    const options = access.options()
    this.persistKey = options?.persistKey
    if (options?.persist === true) this.resolvePersistKey()
  }

  public getActiveDriver(): PersistenceDriver | undefined {
    const options = this.access.options()
    return options?.persist === true ? this.access.driver(options.persistSuffix) : undefined
  }

  public restore(defaults: FormBody, driver?: PersistenceDriver): PersistedForm<FormBody> {
    const options = this.access.options()
    if (options?.persist === true && driver) {
      const persisted = driver.get<PersistedForm<FormBody>>(this.resolvePersistKey()) ?? null
      const context = {
        formName: this.access.formName,
        persistKey: this.resolvePersistKey(),
        persistSuffix: options.persistSuffix,
        defaults,
        persisted
      }
      const decision =
        persisted !== null && !isPersistedFormLike(persisted, defaults)
          ? { action: 'discard' as const, reason: 'invalid_persisted_state', persisted: undefined, details: undefined }
          : this.access.restorePolicy().resolve(context)

      this.access.log({
        formName: context.formName,
        persistKey: context.persistKey,
        persistSuffix: context.persistSuffix,
        action: decision.action,
        reason: decision.reason,
        details: decision.details
      })

      if (decision.action === 'restore' && decision.persisted) {
        return {
          state: restorePropertyAwareStructure(defaults, decision.persisted.state),
          original: restorePropertyAwareStructure(defaults, cloneFormValue(decision.persisted.original)),
          touched: decision.persisted.touched
        }
      }

      if (decision.action === 'discard') driver.remove(this.resolvePersistKey())
    }

    const touched = {} as Record<keyof FormBody, boolean>
    for (const key in defaults) touched[key] = false

    return {
      state: defaults,
      original: restorePropertyAwareStructure(defaults, cloneFormValue(defaults)),
      touched
    }
  }

  public persist(state: FormBody, original: FormBody, touched: Record<keyof FormBody, boolean>, driver?: PersistenceDriver): void {
    if (this.access.options()?.persist !== true) return

    const persistDriver = driver ?? this.getActiveDriver()
    if (!persistDriver) return

    persistDriver.set(this.resolvePersistKey(), {
      state: toRaw(state),
      original: toRaw(original),
      touched: toRaw(touched)
    } satisfies PersistedForm<FormBody>)
  }

  private resolvePersistKey(): string {
    if (!this.persistKey) throw new Error('BaseForm persistence requires a stable persistKey option.')
    return this.persistKey
  }
}
