import { Injectable, inject } from '@angular/core';
import {
  collection as fsCollection,
  getDocs,
  query,
  where,
} from 'firebase/firestore/lite';
import { EntityKind, EntityRef } from '@shared/models';
import {
  CacheInvalidationBus,
  DirectoryRowInputs,
  UniverseEntityService,
} from '@shared/data-access';
import { retryOnTransient } from '@shared/utils';
import { buildPlotlineDirectoryInputs } from './plotline-projection';
import {
  Plotline,
  PlotlineDraft,
  PlotlineMember,
  deriveMemberKeys,
  memberKeyOf,
} from './plotline.types';

@Injectable({ providedIn: 'root' })
export class PlotlinesService extends UniverseEntityService<Plotline, PlotlineDraft> {
  protected readonly collectionName = 'plotlines';
  protected readonly kind: EntityKind = 'plotline';

  private readonly cacheBus = inject(CacheInvalidationBus);
  private readonly containingCache = new Map<string, Plotline[]>();

  constructor() {
    super();
    this.cacheBus.entityWrites$.subscribe(({ kind }) => {
      if (kind === 'plotline') this.containingCache.clear();
    });
  }

  protected toDirectoryInputs(entity: Plotline): DirectoryRowInputs {
    return buildPlotlineDirectoryInputs(entity);
  }

  /**
   * Replace a plotline's ordered membership. `members` is the authored
   * source of truth; `memberKeys` is derived for the reverse lookup and
   * written in the same patch. Both are canonical-only (not projected),
   * so this rides the non-projected `patchFields` escape hatch.
   */
  async setMembers(id: string, members: readonly PlotlineMember[]): Promise<void> {
    await this.patchFields(id, {
      members: [...members],
      memberKeys: deriveMemberKeys(members),
    });
  }

  /**
   * Reverse lookup: which plotlines contain this story / event. Member-only
   * query over canonical `plotlines` via `memberKeys` array-contains.
   * Session-cached per `(universe, entity)`; the cache clears on any
   * plotline write through the cache-invalidation bus.
   */
  async plotlinesContaining(entity: EntityRef<'story' | 'event'>): Promise<Plotline[]> {
    const universeId = this.requireUniverseId();
    const key = `${universeId}:${memberKeyOf(entity)}`;
    const cached = this.containingCache.get(key);
    if (cached) return cached;

    const q = query(
      fsCollection(this.firebase.firestore, 'universes', universeId, this.collectionName),
      where('memberKeys', 'array-contains', memberKeyOf(entity)),
    );
    const snap = await retryOnTransient(() => getDocs(q));
    const out = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Plotline);
    this.containingCache.set(key, out);
    return out;
  }
}
