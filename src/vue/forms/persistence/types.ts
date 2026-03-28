import { type PersistedForm } from '../types/PersistedForm'

export interface PersistenceRestoreContext<FormBody extends object> {
  formName: string
  persistSuffix?: string | undefined
  defaults: FormBody
  persisted: PersistedForm<FormBody> | null
}

export interface PersistenceRestoreResult<FormBody extends object> {
  action: 'restore' | 'discard' | 'ignore'
  reason: string
  persisted?: PersistedForm<FormBody> | undefined
  details?: Record<string, unknown> | undefined
}

export interface PersistenceDebugEvent<FormBody extends object> {
  formName: string
  persistSuffix?: string | undefined
  action: PersistenceRestoreResult<FormBody>['action']
  reason: string
  details?: Record<string, unknown> | undefined
}

export interface PersistenceRestorePolicy<FormBody extends object> {
  resolve(context: PersistenceRestoreContext<FormBody>): PersistenceRestoreResult<FormBody>
}
