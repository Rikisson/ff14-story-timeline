import { effect, inject, Injectable, PLATFORM_ID, signal, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore/lite';
import { UniverseStore } from '@features/universes';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { Character, CharacterDraft, StoredCharacter } from './character.types';

const PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class CharactersService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _characters = signal<Character[]>([]);
  readonly characters: Signal<Character[]> = this._characters.asReadonly();

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        const id = this.universes.activeUniverseId();
        if (!id) {
          this._characters.set([]);
          return;
        }
        void this.refresh(id);
      });
    }
  }

  async refresh(universeId?: string): Promise<void> {
    const id = universeId ?? this.universes.activeUniverseId();
    if (!id) {
      this._characters.set([]);
      return;
    }
    const q = query(
      collection(this.firebase.firestore, 'universes', id, 'characters'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    this._characters.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredCharacter) })));
  }

  async create(draft: CharacterDraft, authorUid: string): Promise<string> {
    const universeId = this.requireUniverseId();
    const id = crypto.randomUUID();
    const data: StoredCharacter = {
      ...draft,
      authorUid,
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firebase.firestore, 'universes', universeId, 'characters', id), data);
    await this.refresh(universeId);
    return id;
  }

  async update(id: string, patch: CharacterDraft): Promise<void> {
    const universeId = this.requireUniverseId();
    await updateDoc(
      doc(this.firebase.firestore, 'universes', universeId, 'characters', id),
      { ...patch },
    );
    await this.refresh(universeId);
  }

  async remove(id: string): Promise<void> {
    const universeId = this.requireUniverseId();
    await deleteDoc(doc(this.firebase.firestore, 'universes', universeId, 'characters', id));
    await this.refresh(universeId);
  }

  private requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }
}
