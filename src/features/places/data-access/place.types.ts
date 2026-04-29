export interface Place {
  id: string;
  slug: string;
  name: string;
  geoPosition: string;
  factions: string[];
  authorUid: string;
  createdAt: number;
}

export type StoredPlace = Omit<Place, 'id'>;

export interface PlaceDraft {
  slug: string;
  name: string;
  geoPosition: string;
  factions: string[];
}
