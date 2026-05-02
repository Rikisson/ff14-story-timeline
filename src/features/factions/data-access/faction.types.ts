import { EntityRef } from '@shared/models';

export interface Faction {
  id: string;
  slug: string;
  name: string;
  type?: string;
  description?: string;
  headquarters?: EntityRef<'place'>;
  relatedCharacters?: EntityRef<'character'>[];
  relatedPlaces?: EntityRef<'place'>[];
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredFaction = Omit<Faction, 'id'>;

export interface FactionDraft {
  slug: string;
  name: string;
  type?: string;
  description?: string;
  headquarters?: EntityRef<'place'>;
  relatedCharacters?: EntityRef<'character'>[];
  relatedPlaces?: EntityRef<'place'>[];
}
