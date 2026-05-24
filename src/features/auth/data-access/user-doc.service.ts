import { inject, Injectable } from '@angular/core';
import {
  doc,
  DocumentReference,
  runTransaction,
  Transaction,
} from 'firebase/firestore/lite';
import { FirebaseService } from '../../../app/firebase/firebase.service';

export async function bootstrapUserDocTxBody(
  tx: Pick<Transaction, 'get' | 'set'>,
  userRef: DocumentReference,
  now: number,
): Promise<void> {
  const snap = await tx.get(userRef);
  if (snap.exists()) return;
  tx.set(userRef, {
    authoredUniverseCount: 0,
    createdAt: now,
  });
}

@Injectable({ providedIn: 'root' })
export class UserDocService {
  private readonly firebase = inject(FirebaseService);

  async bootstrap(uid: string): Promise<void> {
    const userRef = doc(this.firebase.firestore, 'users', uid);
    await runTransaction(this.firebase.firestore, (tx) =>
      bootstrapUserDocTxBody(tx, userRef, Date.now()),
    );
  }
}
