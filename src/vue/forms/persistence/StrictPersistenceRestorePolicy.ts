import { type PersistedForm } from '../types/PersistedForm'
import { collectPropertyAwareMismatchPaths, propertyAwareDeepEqual } from './utils'
import { type PersistenceRestoreContext, type PersistenceRestorePolicy, type PersistenceRestoreResult } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isPersistedFormLike<FormBody extends object>(value: unknown, defaults: FormBody): value is PersistedForm<FormBody> {
  if (!isRecord(value)) {
    return false
  }

  const state = value['state']
  const original = value['original']
  const touched = value['touched']
  if (!isRecord(state) || !isRecord(original) || !isRecord(touched)) {
    return false
  }

  const fields = Object.keys(defaults)
  const declared = new Set(fields)
  return (
    fields.length === Object.keys(touched).length &&
    fields.every((field) => Object.prototype.hasOwnProperty.call(touched, field) && typeof touched[field] === 'boolean') &&
    Object.keys(state).every((field) => declared.has(field)) &&
    Object.keys(original).every((field) => declared.has(field))
  )
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

    if (!isPersistedFormLike(persisted, defaults)) {
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
