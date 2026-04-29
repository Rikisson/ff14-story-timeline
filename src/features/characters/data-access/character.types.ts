export interface Character {
  id: string;
  slug: string;
  name: string;
  race: string;
  job: string;
  authorUid: string;
  createdAt: number;
}

export type StoredCharacter = Omit<Character, 'id'>;

export interface CharacterDraft {
  slug: string;
  name: string;
  race: string;
  job: string;
}
