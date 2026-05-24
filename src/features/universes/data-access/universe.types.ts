export type UniverseLocale = 'en' | 'uk';

export const SUPPORTED_UNIVERSE_LOCALES: readonly UniverseLocale[] = ['en', 'uk'];

export const DEFAULT_UNIVERSE_LOCALE: UniverseLocale = 'en';

export interface Universe {
  id: string;
  slug: string;
  name: string;
  description?: string;
  coverAssetId?: string;
  locale: UniverseLocale;
  authorUid: string;
  editorUids: string[];
  deletedAt: number | null;
  storageBytes: number;
  assetCount: number;
  createdAt: number;
  updatedAt?: number;
}

export type StoredUniverse = Omit<Universe, 'id'>;

export interface UniverseDraft {
  slug: string;
  name: string;
  description?: string;
  locale: UniverseLocale;
}

export interface UniverseUpdate {
  slug?: string;
  name?: string;
  description?: string;
  coverAssetId?: string;
  locale?: UniverseLocale;
}
