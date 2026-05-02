import { EntityRef } from '@shared/models';

export interface CodexEntry {
  id: string;
  slug: string;
  title: string;
  category?: string;
  body: string;
  relatedRefs?: EntityRef[];
  authorUid: string;
  createdAt: number;
  updatedAt?: number;
}

export type StoredCodexEntry = Omit<CodexEntry, 'id'>;

export interface CodexEntryDraft {
  slug: string;
  title: string;
  category?: string;
  body: string;
  relatedRefs?: EntityRef[];
}
