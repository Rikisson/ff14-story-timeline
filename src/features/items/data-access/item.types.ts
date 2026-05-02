import { EntityRef } from '@shared/models';

export interface Item {
  id: string;
  slug: string;
  name: string;
  type?: string;
  description?: string;
  image?: string;
  owner?: EntityRef<'character'>;
  place?: EntityRef<'place'>;
  relatedCharacters?: EntityRef<'character'>[];
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredItem = Omit<Item, 'id'>;

export interface ItemDraft {
  slug: string;
  name: string;
  type?: string;
  description?: string;
  image?: string;
  owner?: EntityRef<'character'>;
  place?: EntityRef<'place'>;
  relatedCharacters?: EntityRef<'character'>[];
}
