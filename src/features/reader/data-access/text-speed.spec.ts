import { describe, expect, it } from 'vitest';
import { Scene, TextSpeed } from '@features/stories';
import { resolveEffectiveTextSpeed } from './text-speed';

const baseScene: Scene = {
  text: '',
  characters: [],
  position: { x: 0, y: 0 },
  next: [],
};

describe('resolveEffectiveTextSpeed', () => {
  it("defaults to 'fast' when scene has no authored speed and prefs allow animations", () => {
    expect(resolveEffectiveTextSpeed(baseScene, { allowTextAnimations: true })).toBe('fast');
  });

  it('honors authored speed when prefs allow animations', () => {
    const speeds: TextSpeed[] = ['slow', 'normal', 'fast', 'instant'];
    for (const textSpeed of speeds) {
      const scene: Scene = { ...baseScene, textSpeed };
      expect(resolveEffectiveTextSpeed(scene, { allowTextAnimations: true })).toBe(textSpeed);
    }
  });

  it("forces 'instant' when prefs disable animations, regardless of authored speed", () => {
    const speeds: TextSpeed[] = ['slow', 'normal', 'fast', 'instant'];
    for (const textSpeed of speeds) {
      const scene: Scene = { ...baseScene, textSpeed };
      expect(resolveEffectiveTextSpeed(scene, { allowTextAnimations: false })).toBe('instant');
    }
  });

  it("returns 'fast' (default) for a null scene when animations are allowed", () => {
    expect(resolveEffectiveTextSpeed(null, { allowTextAnimations: true })).toBe('fast');
  });

  it("returns 'instant' for a null scene when animations are disabled", () => {
    expect(resolveEffectiveTextSpeed(null, { allowTextAnimations: false })).toBe('instant');
  });
});
