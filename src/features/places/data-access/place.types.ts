import { EntityRef } from '@shared/models';

export interface Place {
  id: string;
  slug: string;
  name: string;
  geoPosition: string;
  factions: string[];
  description?: string;
  type?: string;
  parentPlace?: EntityRef<'place'>;
  shortDescription?: string;
  atmosphere?: string;
  image?: string;
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredPlace = Omit<Place, 'id'>;

export interface PlaceDraft {
  slug: string;
  name: string;
  geoPosition: string;
  factions: string[];
  description?: string;
  type?: string;
  parentPlace?: EntityRef<'place'>;
  shortDescription?: string;
  atmosphere?: string;
  image?: string;
}
