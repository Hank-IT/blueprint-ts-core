import { type PersistedForm } from '../types/PersistedForm'
import { collectPropertyAwareMismatchPaths, propertyAwareDeepEqual } from './utils'
import { type PersistenceRestoreContext, type PersistenceRestorePolicy, type PersistenceRestoreResult } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isPersistedFormLike<FormBody extends object>(value: unknown): value is PersistedForm<FormBody> {
  if (!isRecord(value)) {
    return false
  }

  return 'state' in value && 'original' in value && 'dirty' in value
}

export class StrictPersistenceRestorePolicy<FormBody extends object> implements PersistenceRestorePolicy<FormBody> {
  public resolve(context: PersistenceRestoreContext<FormBody>): PersistenceRestoreResult<FormBody> {
    const { defaults, persisted } = context

    if (persisted === null) {
      return {
        action: 'ignore',
        reason: 'no_persisted_state'
      }
    }

    if (!isPersistedFormLike<FormBody>(persisted)) {
      return {
        action: 'discard',
        reason: 'invalid_persisted_state'
      }
    }

    if (propertyAwareDeepEqual(defaults, persisted.original)) {
      return {
        action: 'restore',
        reason: 'defaults_match',
        persisted
      }
    }

    return {
      action: 'discard',
      reason: 'defaults_mismatch',
      persisted,
      details: {
        mismatchPaths: collectPropertyAwareMismatchPaths(defaults, persisted.original)
      }
    }
  }
}
