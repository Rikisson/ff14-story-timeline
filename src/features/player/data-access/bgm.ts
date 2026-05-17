import { BgmTransition, Scene, Story } from '@features/stories';

export interface BgmTarget {
  assetId: string | null;
  transition: BgmTransition;
}

/**
 * Lazy authors set `Story.bgmAssetId` only — every scene inherits, the
 * audio element keeps playing across scene changes without restart.
 * Committed authors set `Scene.bgmAssetId` on the scene where the track
 * should change, choose `'crossfade'` or `'cut'`, and may set
 * `Scene.bgmSilence` for explicit quiet moments.
 */
export function resolveEffectiveBgm(scene: Scene | null, story: Story | null): BgmTarget {
  if (!scene) return { assetId: null, transition: 'crossfade' };
  const transition = scene.bgmTransition ?? 'crossfade';
  if (scene.bgmSilence) return { assetId: null, transition };
  const assetId = scene.bgmAssetId ?? story?.bgmAssetId ?? null;
  return { assetId, transition };
}
