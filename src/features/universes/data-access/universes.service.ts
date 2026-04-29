import { inject, Injectable } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore/lite';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { StoredUniverse, Universe, UniverseDraft } from './universe.types';

const PAGE_SIZE = 50;

export class SlugTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`Universe slug "${slug}" is already taken.`);
    this.name = 'SlugTakenError';
  }
}

@Injectable({ providedIn: 'root' })
export class UniversesService {
  private readonly firebase = inject(FirebaseService);

  async listForUser(uid: string): Promise<Universe[]> {
    const owned = query(
      collection(this.firebase.firestore, 'universes'),
      where('ownerUid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const editing = query(
      collection(this.firebase.firestore, 'universes'),
      where('editorUids', 'array-contains', uid),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const [ownedSnap, editingSnap] = await Promise.all([getDocs(owned), getDocs(editing)]);
    const map = new Map<string, Universe>();
    for (const d of ownedSnap.docs) {
      map.set(d.id, { id: d.id, ...(d.data() as StoredUniverse) });
    }
    for (const d of editingSnap.docs) {
      if (!map.has(d.id)) {
        map.set(d.id, { id: d.id, ...(d.data() as StoredUniverse) });
      }
    }
    return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  async get(id: string): Promise<Universe | undefined> {
    const snap = await getDoc(doc(this.firebase.firestore, 'universes', id));
    return snap.exists() ? { id: snap.id, ...(snap.data() as StoredUniverse) } : undefined;
  }

  async findBySlug(slug: string): Promise<Universe | undefined> {
    const q = query(
      collection(this.firebase.firestore, 'universes'),
      where('slug', '==', slug),
      limit(1),
    );
    const snap = await getDocs(q);
    const first = snap.docs[0];
    return first ? { id: first.id, ...(first.data() as StoredUniverse) } : undefined;
  }

  async create(draft: UniverseDraft, ownerUid: string): Promise<string> {
    const existing = await this.findBySlug(draft.slug);
    if (existing) throw new SlugTakenError(draft.slug);

    const id = crypto.randomUUID();
    const data: StoredUniverse = {
      slug: draft.slug,
      name: draft.name,
      description: draft.description,
      ownerUid,
      editorUids: [],
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firebase.firestore, 'universes', id), data);
    return id;
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.firebase.firestore, 'universes', id));
  }
}
