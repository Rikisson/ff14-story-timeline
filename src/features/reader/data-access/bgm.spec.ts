import { describe, expect, it } from 'vitest';
import { Scene, Story } from '@features/stories';
import { resolveEffectiveBgm } from './bgm';

const baseScene: Scene = {
  text: '',
  characters: [],
  position: { x: 0, y: 0 },
  next: [],
};

const baseStory: Story = {
  id: 's',
  slug: 's',
  title: 'S',
  inGameDate: {},
  authorUid: 'u',
  draft: false,
  createdAt: 0,
};

describe('resolveEffectiveBgm', () => {
  it('returns silent crossfade when scene is null', () => {
    expect(resolveEffectiveBgm(null, baseStory)).toEqual({
      assetId: null,
      transition: 'crossfade',
    });
  });

  it('inherits story default when scene has no override', () => {
    const story = { ...baseStory, bgmAssetId: 'main-theme' };
    expect(resolveEffectiveBgm(baseScene, story)).toEqual({
      assetId: 'main-theme',
      transition: 'crossfade',
    });
  });

  it('scene override wins over story default', () => {
    const story = { ...baseStory, bgmAssetId: 'main-theme' };
    const scene: Scene = { ...baseScene, bgmAssetId: 'tavern-fight' };
    expect(resolveEffectiveBgm(scene, story)).toEqual({
      assetId: 'tavern-fight',
      transition: 'crossfade',
    });
  });

  it('silence flag forces null even when story has a default', () => {
    const story = { ...baseStory, bgmAssetId: 'main-theme' };
    const scene: Scene = { ...baseScene, bgmSilence: true };
    expect(resolveEffectiveBgm(scene, story).assetId).toBeNull();
  });

  it('silence flag forces null even when scene has an explicit override', () => {
    const scene: Scene = { ...baseScene, bgmAssetId: 'tavern-fight', bgmSilence: true };
    expect(resolveEffectiveBgm(scene, baseStory).assetId).toBeNull();
  });

  it('honors authored transition', () => {
    const scene: Scene = { ...baseScene, bgmAssetId: 'x', bgmTransition: 'cut' };
    expect(resolveEffectiveBgm(scene, baseStory).transition).toBe('cut');
  });

  it('returns null when neither scene nor story defines a BGM', () => {
    expect(resolveEffectiveBgm(baseScene, baseStory).assetId).toBeNull();
    expect(resolveEffectiveBgm(baseScene, null).assetId).toBeNull();
  });
});
