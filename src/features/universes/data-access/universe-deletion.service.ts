import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore/lite';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { R2Service } from '../../../app/r2/r2.service';
import {
  chunkInto,
  collectAssetKeys,
  FIRESTORE_BATCH_LIMIT,
  R2_BULK_DELETE_CHUNK,
  SUBCOLLECTIONS_TO_DELETE,
} from './universe-deletion.helpers';
import { UniversesService } from './universes.service';

export type DeletionPhase =
  | 'idle'
  | 'soft-deleting'
  | 'cascading'
  | 'done'
  | 'error';

export interface DeletionProgress {
  phase: DeletionPhase;
  processed: number;
  total: number;
  currentStep?: string;
  error?: string;
}

const IDLE: DeletionProgress = { phase: 'idle', processed: 0, total: 0 };

@Injectable({ providedIn: 'root' })
export class UniverseDeletionService {
  private readonly firebase = inject(FirebaseService);
  private readonly r2 = inject(R2Service);
  private readonly universesService = inject(UniversesService);

  private readonly _progress = signal<DeletionProgress>(IDLE);
  readonly progress: Signal<DeletionProgress> = this._progress.asReadonly();
  readonly inFlight = computed(() => {
    const p = this._progress();
    return p.phase === 'soft-deleting' || p.phase === 'cascading';
  });

  async softDeleteAndCascade(universeId: string, authorUid: string): Promise<void> {
    this._progress.set({ phase: 'soft-deleting', processed: 0, total: 0 });
    try {
      await this.universesService.softDelete(universeId, authorUid);
    } catch (err) {
      this.fail(err);
      throw err;
    }
    await this.runCascade(universeId);
  }

  async resumeCascade(universeId: string): Promise<void> {
    this._progress.set({ phase: 'cascading', processed: 0, total: 0 });
    await this.runCascade(universeId);
  }

  acknowledge(): void {
    this._progress.set(IDLE);
  }

  private async runCascade(universeId: string): Promise<void> {
    try {
      this._progress.update((p) => ({ ...p, phase: 'cascading' }));
      await this.cleanupAssets(universeId);
      await this.cleanupStories(universeId);
      for (const name of SUBCOLLECTIONS_TO_DELETE) {
        await this.cleanupSubcollection(universeId, name);
      }
      await deleteDoc(doc(this.firebase.firestore, 'universes', universeId));
      this._progress.update((p) => ({ ...p, phase: 'done', currentStep: undefined }));
    } catch (err) {
      this.fail(err);
      throw err;
    }
  }

  private async cleanupAssets(universeId: string): Promise<void> {
    this._progress.update((p) => ({ ...p, currentStep: '_assets' }));
    const snap = await getDocs(
      collection(this.firebase.firestore, 'universes', universeId, '_assets'),
    );
    if (snap.empty) return;

    this.bumpTotal(snap.docs.length);

    const docsData = snap.docs.map(
      (d) => d.data() as { objects?: { key: string; bytes: number }[] },
    );
    const r2Keys = collectAssetKeys(docsData);

    for (const chunk of chunkInto(r2Keys, R2_BULK_DELETE_CHUNK)) {
      await this.r2.bulkDelete(universeId, chunk).catch((err) => {
        console.warn('cascade bulk-delete partial failure', err);
      });
    }

    await this.batchDelete(
      snap.docs.map((d) =>
        doc(this.firebase.firestore, 'universes', universeId, '_assets', d.id),
      ),
    );
  }

  private async cleanupStories(universeId: string): Promise<void> {
    this._progress.update((p) => ({ ...p, currentStep: 'stories' }));
    const snap = await getDocs(
      collection(this.firebase.firestore, 'universes', universeId, 'stories'),
    );
    if (snap.empty) return;

    this.bumpTotal(snap.docs.length);

    const refs: ReturnType<typeof doc>[] = [];
    for (const d of snap.docs) {
      refs.push(
        doc(
          this.firebase.firestore,
          'universes',
          universeId,
          'stories',
          d.id,
          '_content',
          'main',
        ),
      );
      refs.push(doc(this.firebase.firestore, 'universes', universeId, 'stories', d.id));
    }
    await this.batchDelete(refs);
  }

  private async cleanupSubcollection(universeId: string, name: string): Promise<void> {
    this._progress.update((p) => ({ ...p, currentStep: name }));
    const snap = await getDocs(
      collection(this.firebase.firestore, 'universes', universeId, name),
    );
    if (snap.empty) return;
    this.bumpTotal(snap.docs.length);
    await this.batchDelete(
      snap.docs.map((d) =>
        doc(this.firebase.firestore, 'universes', universeId, name, d.id),
      ),
    );
  }

  private async batchDelete(refs: ReturnType<typeof doc>[]): Promise<void> {
    if (refs.length === 0) return;
    for (const chunk of chunkInto(refs, FIRESTORE_BATCH_LIMIT)) {
      const batch = writeBatch(this.firebase.firestore);
      for (const ref of chunk) batch.delete(ref);
      await batch.commit();
      this._progress.update((p) => ({ ...p, processed: p.processed + chunk.length }));
    }
  }

  private bumpTotal(n: number): void {
    this._progress.update((p) => ({ ...p, total: p.total + n }));
  }

  private fail(err: unknown): void {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    this._progress.update((p) => ({ ...p, phase: 'error', error: message }));
  }
}
