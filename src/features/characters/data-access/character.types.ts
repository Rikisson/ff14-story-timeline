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
  authorUid: string;
  createdAt: number;
}

export type StoredCharacter = Omit<Character, 'id'>;

export interface CharacterDraft {
  slug: string;
  name: string;
  race: string;
  job: string;
  description?: string;
}
