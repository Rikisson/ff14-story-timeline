import { EntityRef } from '@shared/models';

export interface Place {
  id: string;
  slug: string;
  name: string;
  description?: string;
  backgrounds?: string[];
  ambientAudio?: string[];
  relatedRefs?: EntityRef[];
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredPlace = Omit<Place, 'id'>;

export interface PlaceDraft {
  slug: string;
  name: string;
  description?: string;
  relatedRefs?: EntityRef[];
}
