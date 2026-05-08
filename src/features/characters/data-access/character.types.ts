import { EntityRef } from '@shared/models';

export interface CharacterPortrait {
  id: string;
  label: string;
  url: string;
}

export interface Character {
  id: string;
  slug: string;
  name: string;
  description?: string;
  portraits?: CharacterPortrait[];
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
  relatedRefs?: EntityRef[];
}
