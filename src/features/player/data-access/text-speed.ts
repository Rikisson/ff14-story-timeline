import { Scene, TextSpeed } from '@features/stories';

/**
 * Scenes carry an authored `textSpeed` (default `'fast'` when unset).
 * The reader's preferences expose a single boolean override: when text
 * animations are disabled, every scene renders instantly regardless of
 * what the author chose.
 */
export function resolveEffectiveTextSpeed(
  scene: Scene | null,
  prefs: { allowTextAnimations: boolean },
): TextSpeed {
  if (!prefs.allowTextAnimations) return 'instant';
  return scene?.textSpeed ?? 'fast';
}
