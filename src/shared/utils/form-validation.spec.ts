import { describe, expect, it } from 'vitest';
import { resolveValidationError } from './form-validation';

describe('resolveValidationError', () => {
  it('returns null for null errors', () => {
    expect(resolveValidationError(null)).toBeNull();
  });

  it('returns null for an empty errors object', () => {
    expect(resolveValidationError({})).toBeNull();
  });

  it('maps required', () => {
    expect(resolveValidationError({ required: true })).toEqual({
      key: 'general.validation.required',
    });
  });

  it('maps email', () => {
    expect(resolveValidationError({ email: true })).toEqual({
      key: 'general.validation.email',
    });
  });

  it('maps minlength with requiredLength as min param', () => {
    expect(resolveValidationError({ minlength: { requiredLength: 3, actualLength: 1 } })).toEqual({
      key: 'general.validation.minLength',
      params: { min: 3 },
    });
  });

  it('maps minlength with missing requiredLength to min: 0', () => {
    expect(resolveValidationError({ minlength: {} })).toEqual({
      key: 'general.validation.minLength',
      params: { min: 0 },
    });
  });

  it('maps maxlength with requiredLength as max param', () => {
    expect(resolveValidationError({ maxlength: { requiredLength: 50, actualLength: 60 } })).toEqual({
      key: 'general.validation.maxLength',
      params: { max: 50 },
    });
  });

  it('maps maxlength with missing requiredLength to max: 0', () => {
    expect(resolveValidationError({ maxlength: {} })).toEqual({
      key: 'general.validation.maxLength',
      params: { max: 0 },
    });
  });

  it('maps pattern', () => {
    expect(resolveValidationError({ pattern: { requiredPattern: '^[a-z]+$', actualValue: 'ABC' } })).toEqual({
      key: 'general.validation.pattern',
    });
  });

  it('falls back to the first arbitrary key for custom validators', () => {
    expect(resolveValidationError({ slugTaken: true })).toEqual({
      key: 'general.validation.slugTaken',
    });
  });

  it('prefers known keys over custom keys', () => {
    expect(resolveValidationError({ slugTaken: true, required: true })).toEqual({
      key: 'general.validation.required',
    });
  });

  it('respects KNOWN_KEYS priority: required before email', () => {
    expect(resolveValidationError({ email: true, required: true })).toEqual({
      key: 'general.validation.required',
    });
  });

  it('respects KNOWN_KEYS priority: email before minlength', () => {
    expect(resolveValidationError({ minlength: { requiredLength: 5 }, email: true })).toEqual({
      key: 'general.validation.email',
    });
  });
});
