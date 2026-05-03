import { inject, Injectable } from '@angular/core';
import { doc, setDoc } from 'firebase/firestore/lite';
import { StoredUniverse } from '@features/universes';
import { FirebaseService } from '../app/firebase/firebase.service';
import { SEED_CALENDAR, SEED_CHARACTERS, SEED_EVENTS, SEED_PLACES, SEED_STORY } from './seed-data';

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
    const db = this.firebase.firestore;
    await Promise.all(
      SEED_CHARACTERS.map(({ id, ...data }) =>
        setDoc(doc(db, 'universes', DEFAULT_UNIVERSE_ID, 'characters', id), {
          ...data,
          authorUid,
        }),
      ),
    );
  }

  async seedPlaces(authorUid: string): Promise<void> {
    const db = this.firebase.firestore;
    await Promise.all(
      SEED_PLACES.map(({ id, ...data }) =>
        setDoc(doc(db, 'universes', DEFAULT_UNIVERSE_ID, 'places', id), {
          ...data,
          authorUid,
        }),
      ),
    );
  }

  async seedStory(authorUid: string): Promise<void> {
    const { id, ...data } = SEED_STORY;
    await setDoc(doc(this.firebase.firestore, 'universes', DEFAULT_UNIVERSE_ID, 'stories', id), {
      ...data,
      authorUid,
    });
  }

  async seedEvents(authorUid: string): Promise<void> {
    const db = this.firebase.firestore;
    await Promise.all(
      SEED_EVENTS.map(({ id, ...data }) =>
        setDoc(doc(db, 'universes', DEFAULT_UNIVERSE_ID, 'events', id), {
          ...data,
          authorUid,
        }),
      ),
    );
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
      this.seedStory(authorUid),
      this.seedEvents(authorUid),
      this.seedCalendar(),
    ]);
  }
}
