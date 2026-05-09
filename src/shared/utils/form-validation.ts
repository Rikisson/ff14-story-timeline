import { ValidationErrors } from '@angular/forms';

export interface ResolvedValidationError {
  key: string;
  params?: Record<string, unknown>;
}

const KNOWN_KEYS = ['required', 'email', 'minlength', 'maxlength', 'pattern'] as const;

/**
 * Map an Angular ValidationErrors object to a `general.validation.*`
 * translation key plus interpolation params. Picks the first known
 * error in `KNOWN_KEYS` order, then falls back to the first arbitrary
 * key (as `general.validation.<key>`) for custom validators.
 */
export function resolveValidationError(
  errors: ValidationErrors | null,
): ResolvedValidationError | null {
  if (!errors) return null;
  for (const key of KNOWN_KEYS) {
    if (key in errors) return mapKnown(key, errors[key]);
  }
  const firstKey = Object.keys(errors)[0];
  return firstKey ? { key: `general.validation.${firstKey}` } : null;
}

function mapKnown(key: (typeof KNOWN_KEYS)[number], value: unknown): ResolvedValidationError {
  switch (key) {
    case 'required':
      return { key: 'general.validation.required' };
    case 'email':
      return { key: 'general.validation.email' };
    case 'minlength': {
      const v = value as { requiredLength?: number };
      return { key: 'general.validation.minLength', params: { min: v?.requiredLength ?? 0 } };
    }
    case 'maxlength': {
      const v = value as { requiredLength?: number };
      return { key: 'general.validation.maxLength', params: { max: v?.requiredLength ?? 0 } };
    }
    case 'pattern':
      return { key: 'general.validation.pattern' };
  }
}
