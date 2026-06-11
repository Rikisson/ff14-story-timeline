import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { UniverseStore } from '@features/universes';
import { EntityDirectoryService, ResolvedDirectoryRow } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import { CollapsibleSectionComponent } from '@shared/ui';
import {
  Connection,
  connectionTargetsEntry,
  entityKeyOf,
  sourceEntityRef,
} from '../data-access/connection.types';
import { ConnectionsService } from '../data-access/connections.service';
import connectionsEn from '../i18n/en.json';
import connectionsUk from '../i18n/uk.json';

export interface InboundTarget {
  kind: 'story' | 'event';
  id: string;
  sceneId?: string;
  defaultEntrySceneId?: string;
}

interface InboundRow {
  key: string;
  label: string;
  link: readonly [string, string];
  editorOnly: boolean;
}

/**
 * Read-only list of incoming `continues` connections. For a story
 * entry scene the list is filtered to connections targeting that
 * entry; for an event the whole entity is the target.
 */
@Component({
  selector: 'app-inbound-section',
  imports: [CollapsibleSectionComponent, RouterLink, TranslocoDirective],
  providers: [
    provideTranslocoScope({
      scope: 'connections',
      loader: {
        en: () => Promise.resolve(connectionsEn),
        uk: () => Promise.resolve(connectionsUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'connections'">
      <app-collapsible-section [title]="t('section.inbound')">
        @if (loading()) {
          <p class="hint">{{ t('empty.loading') }}</p>
        } @else if (rows().length === 0) {
          <p class="hint">{{ t('empty.noInbound') }}</p>
        } @else {
          <ul class="m-0 flex list-none flex-col gap-1 p-0">
            @for (row of rows(); track row.key) {
              <li class="flex items-center gap-2 text-sm">
                <a class="min-w-0 flex-1 truncate text-accent hover:underline" [routerLink]="row.link">
                  {{ row.label }}
                </a>
                @if (row.editorOnly) {
                  <span class="shrink-0 text-xs text-foreground-faint">{{ t('status.editorOnly') }}</span>
                }
              </li>
            }
          </ul>
        }
      </app-collapsible-section>
    </ng-container>
  `,
  styles: `
    .hint {
      margin: 0;
      font-size: 0.875rem;
      color: var(--color-foreground-faint);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InboundSectionComponent {
  readonly target = input.required<InboundTarget>();

  private readonly connections = inject(ConnectionsService);
  private readonly directory = inject(EntityDirectoryService);
  private readonly universes = inject(UniverseStore);

  protected readonly loading = signal(true);
  private readonly inbound = signal<Connection[]>([]);
  private readonly sourceRows = signal<Map<string, ResolvedDirectoryRow>>(new Map());

  protected readonly rows = computed<InboundRow[]>(() => {
    const target = this.target();
    const resolved = this.sourceRows();
    const out: InboundRow[] = [];
    const seen = new Set<string>();
    for (const c of this.inbound()) {
      if (
        target.kind === 'story' &&
        target.sceneId !== undefined &&
        target.defaultEntrySceneId !== undefined &&
        !connectionTargetsEntry(c, {
          sceneId: target.sceneId,
          defaultEntrySceneId: target.defaultEntrySceneId,
        })
      ) {
        continue;
      }
      const srcRef = sourceEntityRef(c.from);
      const key = entityKeyOf(srcRef);
      if (seen.has(key)) continue;
      seen.add(key);
      const row = resolved.get(key);
      out.push({
        key,
        label: row?.label ?? c.snapshotTitle ?? srcRef.id,
        link:
          srcRef.kind === 'story'
            ? (['/editor', srcRef.id] as const)
            : (['/events', srcRef.id] as const),
        editorOnly: c.visibility === 'editor',
      });
    }
    return out;
  });

  constructor() {
    let seq = 0;
    effect(() => {
      const target = this.target();
      const mySeq = ++seq;
      untracked(() => void this.load(target, () => mySeq === seq));
    });
  }

  private async load(target: InboundTarget, isCurrent: () => boolean): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.connections.inboundFor({ kind: target.kind, id: target.id });
      if (!isCurrent()) return;
      this.inbound.set(rows);
      const refs: EntityRef[] = rows.map((c) => sourceEntityRef(c.from));
      const universeId = this.universes.activeUniverseId();
      if (universeId && refs.length > 0) {
        const resolved = await this.directory.byIds({ universeId, refs, includeDrafts: true });
        if (!isCurrent()) return;
        const map = new Map<string, ResolvedDirectoryRow>();
        for (const row of resolved) map.set(`${row.kind}:${row.id}`, row);
        this.sourceRows.set(map);
      } else {
        this.sourceRows.set(new Map());
      }
    } finally {
      if (isCurrent()) this.loading.set(false);
    }
  }
}
