import { DocumentReference, Transaction } from 'firebase/firestore/lite';
import type { StoredAsset } from './asset.types';

export interface AssetWriteRefs {
  assetRef: DocumentReference;
  universeRef: DocumentReference;
}

export type IncrementFactory = (n: number) => unknown;

export async function uploadCommitTxBody(
  tx: Pick<Transaction, 'get' | 'set' | 'update'>,
  refs: AssetWriteRefs,
  data: StoredAsset,
  increment: IncrementFactory,
): Promise<void> {
  tx.set(refs.assetRef, data);
  tx.update(refs.universeRef, {
    storageBytes: increment(data.totalBytes),
    assetCount: increment(1),
    updatedAt: data.createdAt,
  });
}

export async function assetDeleteTxBody(
  tx: Pick<Transaction, 'get' | 'set' | 'update' | 'delete'>,
  refs: AssetWriteRefs,
  increment: IncrementFactory,
): Promise<void> {
  const snap = await tx.get(refs.assetRef);
  if (!snap.exists()) return;
  const data = snap.data() as StoredAsset;
  tx.delete(refs.assetRef);
  tx.update(refs.universeRef, {
    storageBytes: increment(-data.totalBytes),
    assetCount: increment(-1),
    updatedAt: Date.now(),
  });
}
