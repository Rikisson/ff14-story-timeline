import { inject, Injectable } from '@angular/core';
import { doc, setDoc } from 'firebase/firestore/lite';
import { StoredUniverse } from '@features/universes';
import { FirebaseService } from '../app/firebase/firebase.service';
import {
  SEED_CALENDAR,
  SEED_CHARACTERS,
  SEED_CODEX_ENTRIES,
  SEED_EVENTS,
  SEED_FACTIONS,
  SEED_ITEMS,
  SEED_PLACES,
  SEED_PLOTLINES,
  SEED_STORIES,
} from './seed-data';

export const DEFAULT_UNIVERSE_ID = 'universe-default';
export const DEFAULT_UNIVERSE_SLUG = 'default-universe';

@Injectable({ providedIn: 'root' })
export class SeederService {
  private readonly firebase = inject(FirebaseService);

  async seedDefaultUniverse(authorUid: string): Promise<void> {
    const data: StoredUniverse = {
      slug: DEFAULT_UNIVERSE_SLUG,
      name: 'Default universe',
      description: 'Seeded universe used for bootstrap data.',
      ownerUid: authorUid,
      editorUids: [],
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firebase.firestore, 'universes', DEFAULT_UNIVERSE_ID), data);
  }

  async seedCharacters(authorUid: string): Promise<void> {
    await this.seedCollection('characters', SEED_CHARACTERS, authorUid);
  }

  async seedPlaces(authorUid: string): Promise<void> {
    await this.seedCollection('places', SEED_PLACES, authorUid);
  }

  async seedStories(authorUid: string): Promise<void> {
    await this.seedCollection('stories', SEED_STORIES, authorUid);
  }

  async seedEvents(authorUid: string): Promise<void> {
    await this.seedCollection('events', SEED_EVENTS, authorUid);
  }

  async seedPlotlines(authorUid: string): Promise<void> {
    await this.seedCollection('plotlines', SEED_PLOTLINES, authorUid);
  }

  async seedItems(authorUid: string): Promise<void> {
    await this.seedCollection('items', SEED_ITEMS, authorUid);
  }

  async seedFactions(authorUid: string): Promise<void> {
    await this.seedCollection('factions', SEED_FACTIONS, authorUid);
  }

  async seedCodexEntries(authorUid: string): Promise<void> {
    await this.seedCollection('codexEntries', SEED_CODEX_ENTRIES, authorUid);
  }

  async seedCalendar(): Promise<void> {
    await setDoc(
      doc(this.firebase.firestore, 'universes', DEFAULT_UNIVERSE_ID, '_meta', 'calendar'),
      SEED_CALENDAR,
    );
  }

  async seedAll(authorUid: string): Promise<void> {
    await this.seedDefaultUniverse(authorUid);
    await Promise.all([
      this.seedCharacters(authorUid),
      this.seedPlaces(authorUid),
      this.seedPlotlines(authorUid),
      this.seedItems(authorUid),
      this.seedFactions(authorUid),
      this.seedCodexEntries(authorUid),
      this.seedStories(authorUid),
      this.seedEvents(authorUid),
      this.seedCalendar(),
    ]);
  }

  private async seedCollection<T extends { id: string }>(
    collectionName: string,
    items: T[],
    authorUid: string,
  ): Promise<void> {
    const db = this.firebase.firestore;
    await Promise.all(
      items.map(({ id, ...data }) =>
        setDoc(doc(db, 'universes', DEFAULT_UNIVERSE_ID, collectionName, id), {
          ...data,
          authorUid,
        }),
      ),
    );
  }
}
