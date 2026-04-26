import { inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { Character, CharacterDraft, StoredCharacter } from './character.types';

@Injectable({ providedIn: 'root' })
export class CharactersService {
  private readonly firebase = inject(FirebaseService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly characters: Signal<Character[]>;

  constructor() {
    const sig = signal<Character[]>([]);
    if (this.isBrowser) {
      const q = query(
        collection(this.firebase.firestore, 'characters'),
        orderBy('createdAt', 'desc'),
      );
      onSnapshot(q, (snap) => {
        sig.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredCharacter) })));
      });
    }
    this.characters = sig.asReadonly();
  }

  async create(draft: CharacterDraft, authorUid: string): Promise<string> {
    const id = crypto.randomUUID();
    const data: StoredCharacter = {
      ...draft,
      authorUid,
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firebase.firestore, 'characters', id), data);
    return id;
  }

  async update(id: string, patch: CharacterDraft): Promise<void> {
    await updateDoc(doc(this.firebase.firestore, 'characters', id), { ...patch });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firebase.firestore, 'characters', id));
  }
}
