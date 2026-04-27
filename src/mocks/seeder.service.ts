import { inject, Injectable } from '@angular/core';
import { doc, setDoc } from 'firebase/firestore/lite';
import { FirebaseService } from '../app/firebase/firebase.service';
import { SEED_CHARACTERS, SEED_EVENTS, SEED_PLACES, SEED_STORY } from './seed-data';

@Injectable({ providedIn: 'root' })
export class SeederService {
  private readonly firebase = inject(FirebaseService);

  async seedCharacters(authorUid: string): Promise<void> {
    const db = this.firebase.firestore;
    await Promise.all(
      SEED_CHARACTERS.map(({ id, ...data }) =>
        setDoc(doc(db, 'characters', id), { ...data, authorUid }),
      ),
    );
  }

  async seedPlaces(authorUid: string): Promise<void> {
    const db = this.firebase.firestore;
    await Promise.all(
      SEED_PLACES.map(({ id, ...data }) =>
        setDoc(doc(db, 'places', id), { ...data, authorUid }),
      ),
    );
  }

  async seedStory(authorUid: string): Promise<void> {
    const { id, ...data } = SEED_STORY;
    await setDoc(doc(this.firebase.firestore, 'stories', id), { ...data, authorUid });
  }

  async seedEvents(authorUid: string): Promise<void> {
    const db = this.firebase.firestore;
    await Promise.all(
      SEED_EVENTS.map(({ id, ...data }) =>
        setDoc(doc(db, 'events', id), { ...data, authorUid }),
      ),
    );
  }

  async seedAll(authorUid: string): Promise<void> {
    await Promise.all([
      this.seedCharacters(authorUid),
      this.seedPlaces(authorUid),
      this.seedStory(authorUid),
      this.seedEvents(authorUid),
    ]);
  }
}
