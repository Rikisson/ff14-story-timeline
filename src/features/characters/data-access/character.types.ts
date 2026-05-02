import { EntityRef } from '@shared/models';

export interface CharacterPortrait {
  id: string;
  label: string;
  url: string;
}

export interface CharacterRelation {
  character: EntityRef<'character'>;
  relation: string;
  description?: string;
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
  residence?: EntityRef<'place'>;
  shortDescription?: string;
  personality?: string;
  motivation?: string;
  backstory?: string;
  relatedCharacters?: CharacterRelation[];
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
  residence?: EntityRef<'place'>;
  shortDescription?: string;
  personality?: string;
  motivation?: string;
  backstory?: string;
  relatedCharacters?: CharacterRelation[];
}
