import { describe, expect, it } from 'vitest'
import { RequiredRule } from '../../../../src/vue/forms/validation/rules/RequiredRule'
import { EmailRule } from '../../../../src/vue/forms/validation/rules/EmailRule'
import { MinRule } from '../../../../src/vue/forms/validation/rules/MinRule'
import { UrlRule } from '../../../../src/vue/forms/validation/rules/UrlRule'
import { ConfirmedRule } from '../../../../src/vue/forms/validation/rules/ConfirmedRule'
import { JsonRule } from '../../../../src/vue/forms/validation/rules/JsonRule'
import { ValidationMode } from '../../../../src/vue/forms/validation/ValidationMode.enum'

describe('Validation rules', () => {
  it('RequiredRule validates presence', () => {
    const rule = new RequiredRule()

    expect(rule.validate('')).toBe(false)
    expect(rule.validate(null as unknown as string)).toBe(false)
    expect(rule.validate(undefined as unknown as string)).toBe(false)
    expect(rule.validate(0 as unknown as string)).toBe(true)
    expect(rule.getMessage()).toBe('This field is required')
  })

  it('EmailRule validates email format', () => {
    const rule = new EmailRule()

    expect(rule.validate('')).toBe(true)
    expect(rule.validate(123)).toBe(false)
    expect(rule.validate('invalid')).toBe(false)
    expect(rule.validate('test@example.com')).toBe(true)
  })

  it('MinRule validates numbers, strings, and arrays', () => {
    const rule = new MinRule(3)

    expect(rule.validate(null)).toBe(true)
    expect(rule.validate('ab')).toBe(false)
    expect(rule.validate('abc')).toBe(true)
    expect(rule.validate(2)).toBe(false)
    expect(rule.validate(3)).toBe(true)
    expect(rule.validate([1, 2])).toBe(false)
    expect(rule.validate([1, 2, 3])).toBe(true)
    expect(rule.validate({})).toBe(false)
    expect(rule.getMessage()).toBe('This field must be at least 3')
  })

  it('UrlRule validates URLs', () => {
    const rule = new UrlRule()

    expect(rule.validate('')).toBe(false)
    expect(rule.validate('not a url')).toBe(false)
    expect(rule.validate('https://example.com')).toBe(true)
  })

  it('ConfirmedRule validates matching fields', () => {
    const rule = new ConfirmedRule<{ password: string; confirm: string }>('confirm')

    expect(rule.dependsOn).toEqual(['confirm'])
    expect(rule.getBidirectionalFields()).toEqual(['confirm'])

    expect(rule.validate('', { password: '', confirm: '' })).toBe(true)
    expect(rule.validate('a', { password: 'a', confirm: 'a' })).toBe(true)
    expect(rule.validate('a', { password: 'a', confirm: 'b' })).toBe(false)
  })

  it('JsonRule validates JSON strings', () => {
    const rule = new JsonRule()

    expect(rule.validate('')).toBe(true)
    expect(rule.validate('{"ok":true}')).toBe(true)
    expect(rule.validate('{ bad }')).toBe(false)
    expect(rule.validate(123)).toBe(false)
  })

  it('ValidationMode has combined flags', () => {
    expect(ValidationMode.DEFAULT).toBe(ValidationMode.ON_TOUCH | ValidationMode.ON_DIRTY | ValidationMode.ON_SUBMIT)
    expect(ValidationMode.AGGRESSIVE).toBe(
      ValidationMode.INSTANTLY | ValidationMode.ON_TOUCH | ValidationMode.ON_DIRTY | ValidationMode.ON_SUBMIT
    )
    expect(ValidationMode.PASSIVE).toBe(ValidationMode.ON_SUBMIT)
  })
})
