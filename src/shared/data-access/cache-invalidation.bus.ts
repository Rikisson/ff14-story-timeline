import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { EntityKind } from '@shared/models';

/**
 * Pub-sub for cross-service cache invalidation. Per docs
 * `backend-rules.md` *Cache invalidation*:
 *
 * - `entity-write` invalidates `EntityResolverCache` entries keyed by
 *   `(universeId, kind, id)` and dirties matching rows in any active
 *   query store (directory, timeline, lane).
 * - `asset-write` invalidates `AssetThumbResolver` entries keyed by
 *   `(universeId, assetId)`.
 *
 * Publishers are the write paths (`writeEntityWithProjections`,
 * `MediaAssetsService`, the categories service category-rename rebuild,
 * the projection rebuild script). Subscribers are the session-scoped
 * caches and query stores.
 */
export interface EntityWriteEvent {
  universeId: string;
  kind: EntityKind;
  id: string;
}

export interface AssetWriteEvent {
  universeId: string;
  assetId: string;
}

@Injectable({ providedIn: 'root' })
export class CacheInvalidationBus {
  private readonly _entityWrites = new Subject<EntityWriteEvent>();
  private readonly _assetWrites = new Subject<AssetWriteEvent>();

  readonly entityWrites$: Observable<EntityWriteEvent> = this._entityWrites.asObservable();
  readonly assetWrites$: Observable<AssetWriteEvent> = this._assetWrites.asObservable();

  publishEntityWrite(event: EntityWriteEvent): void {
    this._entityWrites.next(event);
  }

  publishAssetWrite(event: AssetWriteEvent): void {
    this._assetWrites.next(event);
  }
}
