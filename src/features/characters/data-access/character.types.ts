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
  race: string;
  job: string;
  description?: string;
  portraits?: CharacterPortrait[];
  aliases?: string[];
  title?: string;
  gender?: string;
  age?: string;
  affiliation?: string;
  relatedRefs?: EntityRef[];
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredCharacter = Omit<Character, 'id'>;

export interface CharacterDraft {
  slug: string;
  name: string;
  race: string;
  job: string;
  description?: string;
  aliases?: string[];
  title?: string;
  gender?: string;
  age?: string;
  affiliation?: string;
  relatedRefs?: EntityRef[];
}
