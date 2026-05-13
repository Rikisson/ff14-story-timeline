export type AssetKind = 'cover' | 'sprite' | 'background' | 'ambient' | 'sfx';

export const IMAGE_ASSET_KINDS: readonly AssetKind[] = ['cover', 'sprite', 'background'];
export const AUDIO_ASSET_KINDS: readonly AssetKind[] = ['ambient', 'sfx'];

export interface AssetDoc {
  id: string;
  kind: AssetKind;
  url: string;
  // 640w WebP variant uploaded alongside the full image for cover assets.
  // Consumers rendering in card slots should prefer this; falls back to `url`
  // for assets uploaded before the thumb pipeline existed.
  thumbUrl?: string;
  label: string;
  blurDataUrl?: string;
  tags?: string[];
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredAsset = Omit<AssetDoc, 'id'>;

export interface AssetUploadInput {
  kind: AssetKind;
  file: File;
  label?: string;
  tags?: string[];
  blurDataUrl?: string;
}

export interface AssetListFilter {
  kind?: AssetKind;
  tag?: string;
}
