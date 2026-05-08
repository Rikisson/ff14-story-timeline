export type AssetKind = 'cover' | 'sprite' | 'background' | 'ambient' | 'sfx';

export const IMAGE_ASSET_KINDS: readonly AssetKind[] = ['cover', 'sprite', 'background'];
export const AUDIO_ASSET_KINDS: readonly AssetKind[] = ['ambient', 'sfx'];

export interface AssetDoc {
  id: string;
  kind: AssetKind;
  url: string;
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
