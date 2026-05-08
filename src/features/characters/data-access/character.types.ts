import { EntityRef } from '@shared/models';

export interface Character {
  id: string;
  slug: string;
  name: string;
  description?: string;
  coverAssetId?: string;
  sprites?: string[];
  relatedRefs?: EntityRef[];
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredCharacter = Omit<Character, 'id'>;

export interface CharacterDraft {
  slug: string;
  name: string;
  description?: string;
  coverAssetId?: string;
  relatedRefs?: EntityRef[];
}
