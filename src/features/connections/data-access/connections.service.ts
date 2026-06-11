import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore/lite';
import { UniverseStore } from '@features/universes';
import { EntityRef } from '@shared/models';
import { retryOnTransient } from '@shared/utils';
import { FirebaseService } from '../../../app/firebase/firebase.service';
import {
  Connection,
  ConnectionSource,
  ConnectionTarget,
  ConnectionVisibility,
  StoredConnection,
  connectionIdFor,
  deriveConnectionKeys,
  entityKeyOf,
} from './connection.types';

export interface WireConnectionInput {
  from: ConnectionSource;
  to: ConnectionTarget | null;
  visibility: ConnectionVisibility;
  note?: string;
  snapshotTitle?: string;
}

@Injectable({ providedIn: 'root' })
export class ConnectionsService {
  private readonly firebase = inject(FirebaseService);
  private readonly universes = inject(UniverseStore);
  private readonly readerCache = new Map<string, Connection[]>();

  async outboundFor(
    entity: EntityRef<'story' | 'event'>,
    opts?: { readerOnly?: boolean },
  ): Promise<Connection[]> {
    return this.queryByKey('fromEntityKey', entityKeyOf(entity), opts?.readerOnly === true);
  }

  async inboundFor(
    entity: EntityRef<'story' | 'event'>,
    opts?: { readerOnly?: boolean },
  ): Promise<Connection[]> {
    return this.queryByKey('toEntityKey', entityKeyOf(entity), opts?.readerOnly === true);
  }

  async wire(input: WireConnectionInput, uid: string): Promise<void> {
    const universeId = this.requireUniverseId();
    const id = connectionIdFor(input.from);
    const stored: StoredConnection = {
      type: 'continues',
      from: input.from,
      to: input.to,
      ...deriveConnectionKeys(input.from, input.to),
      visibility: input.visibility,
      note: input.note,
      snapshotTitle: input.snapshotTitle,
      createdBy: uid,
      updatedBy: uid,
      updatedAt: Date.now(),
    };
    await setDoc(this.connectionDoc(universeId, id), stripUndefined(stored));
    this.readerCache.clear();
  }

  async updateConnection(
    id: string,
    patch: Partial<Pick<StoredConnection, 'to' | 'visibility' | 'note' | 'snapshotTitle'>>,
    uid: string,
  ): Promise<void> {
    const universeId = this.requireUniverseId();
    const fields: Record<string, unknown> = {
      ...patch,
      updatedBy: uid,
      updatedAt: Date.now(),
    };
    if ('to' in patch) {
      const target = patch.to ?? null;
      fields['to'] = target;
      fields['toEntityKey'] = target ? entityKeyOf({ kind: target.kind, id: target.kind === 'story' ? target.storyId : target.eventId }) : null;
    }
    await updateDoc(this.connectionDoc(universeId, id), stripUndefined(fields));
    this.readerCache.clear();
  }

  async deleteConnection(id: string): Promise<void> {
    const universeId = this.requireUniverseId();
    await deleteDoc(this.connectionDoc(universeId, id));
    this.readerCache.clear();
  }

  async deleteOutboundFor(entity: EntityRef<'story' | 'event'>): Promise<void> {
    const universeId = this.requireUniverseId();
    const snap = await getDocs(
      query(
        this.connectionsRef(universeId),
        where('fromEntityKey', '==', entityKeyOf(entity)),
      ),
    );
    if (snap.docs.length === 0) return;
    const batch = writeBatch(this.firebase.firestore);
    for (const entry of snap.docs) batch.delete(entry.ref);
    await batch.commit();
    this.readerCache.clear();
  }

  private async queryByKey(
    field: 'fromEntityKey' | 'toEntityKey',
    key: string,
    readerOnly: boolean,
  ): Promise<Connection[]> {
    const universeId = this.requireUniverseId();
    const cacheKey = `${universeId}:${field}:${key}`;
    if (readerOnly) {
      const cached = this.readerCache.get(cacheKey);
      if (cached) return cached;
    }
    const constraints = [where(field, '==', key)];
    if (readerOnly) constraints.push(where('visibility', '==', 'reader'));
    const snap = await retryOnTransient(() =>
      getDocs(query(this.connectionsRef(universeId), ...constraints)),
    );
    const rows = snap.docs.map(
      (entry) => ({ id: entry.id, ...entry.data() }) as unknown as Connection,
    );
    if (readerOnly) this.readerCache.set(cacheKey, rows);
    return rows;
  }

  private connectionsRef(universeId: string) {
    return collection(this.firebase.firestore, 'universes', universeId, 'connections');
  }

  private connectionDoc(universeId: string, id: string) {
    return doc(this.firebase.firestore, 'universes', universeId, 'connections', id);
  }

  private requireUniverseId(): string {
    const id = this.universes.activeUniverseId();
    if (!id) throw new Error('No active universe selected.');
    return id;
  }
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const out = {} as Record<string, unknown>;
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) out[key] = entry;
  }
  return out as T;
}
