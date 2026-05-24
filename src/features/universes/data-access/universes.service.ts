import { inject, Injectable } from '@angular/core';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore/lite';
import { CapExceededError, SlugTakenError } from '@shared/models';
import { StaffRole, UserDoc } from '@features/auth';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import {
  DEFAULT_UNIVERSE_LOCALE,
  StoredUniverse,
  Universe,
  UniverseDraft,
  UniverseUpdate,
} from './universe.types';

const PAGE_SIZE = 50;
const UNIVERSE_CAP = 2;

function fromStored(id: string, data: StoredUniverse): Universe {
  return {
    id,
    ...data,
    locale: data.locale ?? DEFAULT_UNIVERSE_LOCALE,
    deletedAt: data.deletedAt ?? null,
    storageBytes: data.storageBytes ?? 0,
    assetCount: data.assetCount ?? 0,
  };
}

@Injectable({ providedIn: 'root' })
export class UniversesService {
  private readonly firebase = inject(FirebaseService);

  async listAll(): Promise<Universe[]> {
    const q = query(
      collection(this.firebase.firestore, 'universes'),
      where('deletedAt', '==', null),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => fromStored(d.id, d.data() as StoredUniverse));
  }

  async get(id: string): Promise<Universe | undefined> {
    const snap = await getDoc(doc(this.firebase.firestore, 'universes', id));
    return snap.exists() ? fromStored(snap.id, snap.data() as StoredUniverse) : undefined;
  }

  async findBySlug(slug: string): Promise<Universe | undefined> {
    const q = query(
      collection(this.firebase.firestore, 'universes'),
      where('slug', '==', slug),
      limit(1),
    );
    const snap = await getDocs(q);
    const first = snap.docs[0];
    return first ? fromStored(first.id, first.data() as StoredUniverse) : undefined;
  }

  async create(draft: UniverseDraft, authorUid: string): Promise<string> {
    const existing = await this.findBySlug(draft.slug);
    if (existing) throw new SlugTakenError('universe', draft.slug);

    const id = crypto.randomUUID();
    const universeRef = doc(this.firebase.firestore, 'universes', id);
    const userRef = doc(this.firebase.firestore, 'users', authorUid);

    await runTransaction(this.firebase.firestore, async (tx) => {
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists() ? (userSnap.data() as UserDoc) : null;
      const currentCount = userData?.authoredUniverseCount ?? 0;
      const isAdmin = userData?.staffRole === 'admin';

      if (currentCount >= UNIVERSE_CAP && !isAdmin) {
        throw new CapExceededError(UNIVERSE_CAP);
      }

      const now = Date.now();
      tx.set(userRef, {
        authoredUniverseCount: currentCount + 1,
        createdAt: userData?.createdAt ?? now,
        updatedAt: now,
        ...(isAdmin ? { staffRole: 'admin' as StaffRole } : {}),
      });

      const data: StoredUniverse = {
        slug: draft.slug,
        name: draft.name,
        description: draft.description,
        locale: draft.locale,
        authorUid,
        editorUids: [],
        deletedAt: null,
        storageBytes: 0,
        assetCount: 0,
        createdAt: now,
      };
      tx.set(universeRef, data);
    });

    return id;
  }

  async softDelete(universeId: string, authorUid: string): Promise<void> {
    const universeRef = doc(this.firebase.firestore, 'universes', universeId);
    const userRef = doc(this.firebase.firestore, 'users', authorUid);
    const now = Date.now();
    await runTransaction(this.firebase.firestore, async (tx) => {
      tx.update(universeRef, { deletedAt: now, updatedAt: now });
      tx.update(userRef, {
        authoredUniverseCount: increment(-1),
        updatedAt: now,
      });
    });
  }

  async update(id: string, patch: UniverseUpdate): Promise<void> {
    if (patch.slug !== undefined) {
      const existing = await this.findBySlug(patch.slug);
      if (existing && existing.id !== id) {
        throw new SlugTakenError('universe', patch.slug);
      }
    }
    await updateDoc(doc(this.firebase.firestore, 'universes', id), {
      ...patch,
      updatedAt: Date.now(),
    });
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
