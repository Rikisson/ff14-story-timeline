import { inject, Injectable } from '@angular/core';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
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

  async listAll(): Promise<Universe[]> {
    const q = query(
      collection(this.firebase.firestore, 'universes'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredUniverse) }));
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

  async addEditor(universeId: string, uid: string): Promise<void> {
    await updateDoc(doc(this.firebase.firestore, 'universes', universeId), {
      editorUids: arrayUnion(uid),
      updatedAt: Date.now(),
    });
  }

  async removeEditor(universeId: string, uid: string): Promise<void> {
    await updateDoc(doc(this.firebase.firestore, 'universes', universeId), {
      editorUids: arrayRemove(uid),
      updatedAt: Date.now(),
    });
  }
}
