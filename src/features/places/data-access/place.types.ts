export interface Place {
  id: string;
  name: string;
  geoPosition: string;
  factions: string[];
  authorUid: string;
  createdAt: number;
}

export type StoredPlace = Omit<Place, 'id'>;

export interface PlaceDraft {
  name: string;
  geoPosition: string;
  factions: string[];
}
