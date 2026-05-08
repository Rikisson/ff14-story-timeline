export interface Universe {
  id: string;
  slug: string;
  name: string;
  description?: string;
  coverAssetId?: string;
  ownerUid: string;
  editorUids: string[];
  createdAt: number;
  updatedAt?: number;
}

export type StoredUniverse = Omit<Universe, 'id'>;

export interface UniverseDraft {
  slug: string;
  name: string;
  description?: string;
}
