import { inject, Injectable, InjectionToken, Provider } from '@angular/core';
import { EntityKind } from '@shared/models';
import { EntityDirectoryService } from './entity-directory.service';
import { ResolvedDirectoryRow } from './entity-resolver-cache.service';

export interface EntitySearchOptions {
  universeId: string;
  query: string;
  kind?: EntityKind;
  /** Member-only. Public callers must omit. */
  includeDrafts?: boolean;
  limit?: number;
}

/**
 * Search abstraction over `_directory`. v0 is the directory prefix
 * adapter — `EntitySearchService` defaults to `DirectoryEntitySearchService`
 * via the DI token below. When the full-text-search backend (Typesense /
 * Meilisearch, per `docs/backend-rules.md` *Search*) ships, callers
 * swap the provider to a backend-backed adapter without touching the
 * call sites.
 */
export abstract class EntitySearchService {
  abstract search(opts: EntitySearchOptions): Promise<ResolvedDirectoryRow[]>;
}

@Injectable({ providedIn: 'root' })
export class DirectoryEntitySearchService extends EntitySearchService {
  private readonly directory = inject(EntityDirectoryService);

  override search(opts: EntitySearchOptions): Promise<ResolvedDirectoryRow[]> {
    return this.directory.prefixSearch({
      universeId: opts.universeId,
      query: opts.query,
      kind: opts.kind,
      includeDrafts: opts.includeDrafts,
      limit: opts.limit,
    });
  }
}

/**
 * DI token for `EntitySearchService`. Defaults to the directory adapter;
 * provide a different adapter at the app or feature level when wiring
 * a full-text-search backend.
 */
export const ENTITY_SEARCH_SERVICE = new InjectionToken<EntitySearchService>(
  'EntitySearchService',
  {
    providedIn: 'root',
    factory: () => inject(DirectoryEntitySearchService),
  },
);

/** Helper to override the search adapter at the app or route level. */
export function provideEntitySearchService(
  use: new (...args: never[]) => EntitySearchService,
): Provider {
  return { provide: ENTITY_SEARCH_SERVICE, useExisting: use };
}
