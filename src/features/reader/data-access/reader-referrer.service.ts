import { Injectable, signal } from '@angular/core';

export interface ReaderReferrer {
  kind: 'story' | 'event';
  id: string;
  label: string;
  sceneId?: string;
}

/**
 * Session-scoped "where did the reader come from" marker for cross-entity
 * navigation. Set when a continuation anchor is followed; consumed (and
 * cleared) when the unified Back menu navigates to it. Survives the
 * route swap because reader pages are recreated per entity.
 */
@Injectable({ providedIn: 'root' })
export class ReaderReferrerService {
  private readonly state = signal<ReaderReferrer | null>(null);
  readonly current = this.state.asReadonly();

  set(referrer: ReaderReferrer): void {
    this.state.set(referrer);
  }

  clear(): void {
    this.state.set(null);
  }
}
