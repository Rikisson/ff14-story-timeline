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
  where,
} from 'firebase/firestore/lite';
import { UniverseStore } from '@features/universes';
import { SlugTakenError } from '@shared/models';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import { Plotline, PlotlineDraft, StoredPlotline } from './plotline.types';

const PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class PlotlinesService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _plotlines = signal<Plotline[]>([]);
  readonly plotlines: Signal<Plotline[]> = this._plotlines.asReadonly();

  private readonly _refreshError = signal<string | null>(null);
  readonly refreshError: Signal<string | null> = this._refreshError.asReadonly();

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        const id = this.universes.activeUniverseId();
        if (!id) {
          this._plotlines.set([]);
          this._refreshError.set(null);
          return;
        }
        this._refreshError.set(null);
        this.refresh(id).catch((err) => {
          console.error('PlotlinesService.refresh failed', err);
          this._refreshError.set(
            err instanceof Error ? `${err.name}: ${err.message}` : String(err),
          );
        });
      });
    }
  }

  async refresh(universeId?: string): Promise<void> {
    const id = universeId ?? this.universes.activeUniverseId();
    if (!id) {
      this._plotlines.set([]);
      return;
    }
    const q = query(
      collection(this.firebase.firestore, 'universes', id, 'plotlines'),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snap = await getDocs(q);
    this._plotlines.set(snap.docs.map((d) => ({ id: d.id, ...(d.data() as StoredPlotline) })));
  }

  async create(draft: PlotlineDraft, authorUid: string): Promise<string> {
    const universeId = this.requireUniverseId();
    await this.assertSlugAvailable(universeId, draft.slug);
    const id = crypto.randomUUID();
    const data: StoredPlotline = {
      ...draft,
      authorUid,
      createdAt: Date.now(),
    };
    await setDoc(doc(this.firebase.firestore, 'universes', universeId, 'plotlines', id), data);
    await this.refresh(universeId);
    return id;
  }

  async update(id: string, patch: PlotlineDraft): Promise<void> {
    const universeId = this.requireUniverseId();
    await this.assertSlugAvailable(universeId, patch.slug, id);
    await updateDoc(
      doc(this.firebase.firestore, 'universes', universeId, 'plotlines', id),
      { ...patch, updatedAt: Date.now() },
    );
    await this.refresh(universeId);
  }

  async remove(id: string): Promise<void> {
    const universeId = this.requireUniverseId();
    await deleteDoc(doc(this.firebase.firestore, 'universes', universeId, 'plotlines', id));
    await this.refresh(universeId);
  }

  private async assertSlugAvailable(
    universeId: string,
    slug: string,
    excludeId?: string,
  ): Promise<void> {
    const q = query(
      collection(this.firebase.firestore, 'universes', universeId, 'plotlines'),
      where('slug', '==', slug),
      limit(2),
    );
    const snap = await getDocs(q);
    const taken = snap.docs.some((d) => d.id !== excludeId);
    if (taken) throw new SlugTakenError('plotline', slug);
  }

  private requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }
}
