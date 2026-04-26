export interface Character {
  id: string;
  name: string;
  race: string;
  job: string;
  authorUid: string;
  createdAt: number;
}

export type StoredCharacter = Omit<Character, 'id'>;

export interface CharacterDraft {
  name: string;
  race: string;
  job: string;
}
