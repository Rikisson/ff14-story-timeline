import { inject, Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { doc, getDoc } from 'firebase/firestore/lite';
import { UniverseStore } from '@features/universes';
import { EntityKind, EntityRef } from '@shared/models';
import { FirebaseService } from '../../app/firebase/firebase.service';

/**
 * Minimum shape every hover-popover, scene-detail-card, or
 * pre-publish-validation surface needs from a canonical entity beyond
 * what `EntityResolverCache` already gives. The cache pulls the canonical
 * doc once per `(universeId, kind, id)` per session, and exposes the
 * fields below — the description is the load-bearing one (it doesn't
 * live on the directory projection per `docs/narrative-engine-impl.md`
 * *Scope locks — One descriptive prose field per entity, named
 * `description`*).
 */
export interface ResolvedCanonicalEntity {
  kind: EntityKind;
  id: string;
  name: string;
  description?: string;
  slug?: string;
}

const KIND_TO_COLLECTION: Record<EntityKind, string> = {
  character: 'characters',
  place: 'places',
  event: 'events',
  story: 'stories',
  plotline: 'plotlines',
  codexEntry: 'codexEntries',
};

/**
 * On-demand canonical reads by `(kind, id)`, cached for the session.
 * Use this for surfaces that need fields the directory projection
 * doesn't carry — chiefly `description` (per *Scope locks*).
 *
 * The reader is a single-shot `getDoc`; consumers should expect a brief
 * `null` window while the read is in flight and render a fallback.
 */
@Injectable({ providedIn: 'root' })
export class EntityCanonicalCache {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);

  private readonly cache = new Map<string, WritableSignal<ResolvedCanonicalEntity | null>>();
  private readonly inFlight = new Set<string>();

  resolve(ref: EntityRef | null | undefined): Signal<ResolvedCanonicalEntity | null> {
    if (!ref) return EMPTY_SIGNAL;
    const universeId = this.universes.activeUniverseId();
    if (!universeId) return EMPTY_SIGNAL;
    return this.signalFor(universeId, ref);
  }

  private signalFor(universeId: string, ref: EntityRef): Signal<ResolvedCanonicalEntity | null> {
    const key = cacheKey(universeId, ref.kind, ref.id);
    const existing = this.cache.get(key);
    if (existing) return existing.asReadonly();
    const sig = signal<ResolvedCanonicalEntity | null>(null);
    this.cache.set(key, sig);
    if (!this.inFlight.has(key)) {
      this.inFlight.add(key);
      void this.fetch(universeId, ref).then((entity) => {
        sig.set(entity);
        this.inFlight.delete(key);
      });
    }
    return sig.asReadonly();
  }

  private async fetch(
    universeId: string,
    ref: EntityRef,
  ): Promise<ResolvedCanonicalEntity | null> {
    const collection = KIND_TO_COLLECTION[ref.kind];
    const snap = await getDoc(
      doc(this.firebase.firestore, 'universes', universeId, collection, ref.id),
    );
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    return {
      kind: ref.kind,
      id: ref.id,
      name: nameOf(ref.kind, data) ?? ref.id,
      description: stringField(data, 'description'),
      slug: stringField(data, 'slug'),
    };
  }
}

function cacheKey(universeId: string, kind: EntityKind, id: string): string {
  return `${universeId}:${kind}:${id}`;
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const v = data[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Per-kind name field. Character/place use `name`, story/plotline/codex
 * carry the title in `title`. Event uses `name`.
 */
function nameOf(kind: EntityKind, data: Record<string, unknown>): string | undefined {
  switch (kind) {
    case 'character':
    case 'place':
    case 'event':
      return stringField(data, 'name');
    case 'story':
    case 'plotline':
    case 'codexEntry':
      return stringField(data, 'title');
  }
}

const EMPTY_SIGNAL: Signal<ResolvedCanonicalEntity | null> = signal<
  ResolvedCanonicalEntity | null
>(null).asReadonly();
