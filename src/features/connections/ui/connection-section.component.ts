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
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthStore } from '@features/auth';
import { StoriesService } from '@features/stories';
import { UniverseStore } from '@features/universes';
import { EntityDirectoryService, ResolvedDirectoryRow } from '@shared/data-access';
import { EntityRef } from '@shared/models';
import {
  CollapsibleSectionComponent,
  EntityPickerComponent,
  GhostButtonComponent,
  GhostDangerButtonComponent,
  SegmentedControlComponent,
  SegmentOption,
} from '@shared/ui';
import {
  Connection,
  ConnectionSource,
  ConnectionTarget,
  ConnectionVisibility,
  endpointEntityId,
  sourceEntityRef,
  targetEntityRef,
} from '../data-access/connection.types';
import { ConnectionsService } from '../data-access/connections.service';
import connectionsEn from '../i18n/en.json';
import connectionsUk from '../i18n/uk.json';

interface EntrySceneOption {
  id: string;
  label: string;
}

/**
 * Outbound-connection editor for a single source endpoint — an end
 * scene of a story or an event. One outbound per endpoint by
 * construction (deterministic doc id); this section edits that one
 * edge: wire / pending / retarget / visibility / note / delete, plus a
 * stale list for story connections whose source scene no longer exists
 * or is no longer terminal.
 */
@Component({
  selector: 'app-connection-section',
  imports: [
    CollapsibleSectionComponent,
    EntityPickerComponent,
    GhostButtonComponent,
    GhostDangerButtonComponent,
    SegmentedControlComponent,
    TranslocoDirective,
  ],
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
      <app-collapsible-section [title]="t('section.connections')">
        @if (loading()) {
          <p class="hint">{{ t('empty.loading') }}</p>
        } @else {
          @if (connection(); as conn) {
            <div class="flex flex-col gap-2">
              @if (conn.to === null) {
                <p class="text-sm text-foreground-muted">{{ t('status.pending') }}</p>
              } @else if (targetRow(); as row) {
                <p class="m-0 text-sm text-foreground">{{ row.label }}</p>
              } @else {
                <p class="m-0 text-sm text-warning-foreground">
                  {{ t('status.broken') }}
                  @if (conn.snapshotTitle) {
                    <span class="text-foreground-faint"> — {{ t('message.wasTitle', { title: conn.snapshotTitle }) }}</span>
                  }
                </p>
              }

              @if (retargeting() || conn.to === null) {
                <app-entity-picker
                  [value]="emptyRefs"
                  [kinds]="targetKinds"
                  [maxSelections]="1"
                  [includeDrafts]="true"
                  [placeholder]="t('empty.searchTarget')"
                  (valueChange)="onTargetPicked($event)"
                />
              }

              @if (entryOptions(); as entries) {
                @if (entries.length > 1) {
                  <label class="flex flex-col gap-1 text-sm">
                    <span class="font-medium text-foreground-muted">{{ t('field.entryScene') }}</span>
                    <select [value]="selectedEntryScene()" (change)="onEntryScene($event)">
                      <option value="">{{ t('field.entryDefault') }}</option>
                      @for (entry of entries; track entry.id) {
                        <option [value]="entry.id">{{ entry.label }}</option>
                      }
                    </select>
                  </label>
                }
              }

              <div class="flex flex-col gap-1 text-sm">
                <span class="font-medium text-foreground-muted">{{ t('field.visibility') }}</span>
                <app-segmented-control
                  [options]="visibilityOptions()"
                  [value]="conn.visibility"
                  [ariaLabel]="t('field.visibility')"
                  (valueChange)="onVisibility($event)"
                />
              </div>

              <label class="flex flex-col gap-1 text-sm">
                <span class="font-medium text-foreground-muted">{{ t('field.note') }}</span>
                <input
                  type="text"
                  [value]="conn.note ?? ''"
                  [placeholder]="t('empty.notePlaceholder')"
                  (change)="onNote($event)"
                />
              </label>

              <div class="flex flex-wrap gap-2">
                @if (conn.to !== null) {
                  <button uiGhost type="button" (click)="retargeting.set(!retargeting())">
                    {{ retargeting() ? t('action.cancel') : t('action.retarget') }}
                  </button>
                  <button uiGhost type="button" (click)="makePending()">{{ t('action.makePending') }}</button>
                }
                <button uiGhostDanger type="button" (click)="remove()">{{ t('action.delete') }}</button>
              </div>
            </div>
          } @else {
            <p class="hint">{{ t('empty.none') }}</p>
            @if (adding()) {
              <app-entity-picker
                [value]="emptyRefs"
                [kinds]="targetKinds"
                [maxSelections]="1"
                [includeDrafts]="true"
                [placeholder]="t('empty.searchTarget')"
                (valueChange)="onTargetPicked($event)"
              />
              <div class="flex flex-wrap gap-2">
                <button uiGhost type="button" (click)="savePending()">{{ t('action.savePending') }}</button>
                <button uiGhost type="button" (click)="adding.set(false)">{{ t('action.cancel') }}</button>
              </div>
            } @else {
              <button uiGhost type="button" (click)="adding.set(true)">{{ t('action.addContinuation') }}</button>
            }
          }

          @if (staleConnections().length > 0) {
            <div class="mt-3 flex flex-col gap-1 border-t border-border pt-2">
              <p class="m-0 text-sm text-warning-foreground">{{ t('message.stale') }}</p>
              <ul class="m-0 flex list-none flex-col gap-1 p-0">
                @for (stale of staleConnections(); track stale.id) {
                  <li class="flex items-center gap-2 text-sm text-foreground-muted">
                    <span class="min-w-0 flex-1 truncate">
                      {{ stale.snapshotTitle ?? stale.id }}
                      ({{ t('message.fromScene', { label: staleSceneLabel(stale) }) }})
                    </span>
                    <button uiGhostDanger type="button" (click)="removeStale(stale.id)">
                      {{ t('action.deleteStale') }}
                    </button>
                  </li>
                }
              </ul>
            </div>
          }
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
export class ConnectionSectionComponent {
  readonly source = input.required<ConnectionSource>();
  readonly endSceneIds = input<string[] | null>(null);
  readonly sceneLabels = input<Record<string, string>>({});

  private readonly connections = inject(ConnectionsService);
  private readonly directory = inject(EntityDirectoryService);
  private readonly stories = inject(StoriesService);
  private readonly universes = inject(UniverseStore);
  private readonly auth = inject(AuthStore);
  private readonly transloco = inject(TranslocoService);
  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly targetKinds = ['story', 'event'] as const;
  protected readonly emptyRefs: readonly EntityRef[] = [];

  protected readonly adding = signal(false);
  protected readonly retargeting = signal(false);
  protected readonly loading = signal(true);
  private readonly reload = signal(0);
  private readonly outbound = signal<Connection[]>([]);
  protected readonly targetRow = signal<ResolvedDirectoryRow | null>(null);
  protected readonly entryOptions = signal<EntrySceneOption[] | null>(null);

  protected readonly visibilityOptions = computed<SegmentOption<ConnectionVisibility>[]>(() => {
    this.activeLang();
    return [
      { value: 'reader', label: this.transloco.translate('connections.visibility.reader') },
      { value: 'editor', label: this.transloco.translate('connections.visibility.editor') },
    ];
  });

  protected readonly connection = computed<Connection | null>(() => {
    const source = this.source();
    return (
      this.outbound().find((c) =>
        source.kind === 'story'
          ? c.from.kind === 'story' && c.from.sceneId === source.sceneId
          : c.from.kind === 'event',
      ) ?? null
    );
  });

  protected readonly staleConnections = computed<Connection[]>(() => {
    const endSceneIds = this.endSceneIds();
    if (this.source().kind !== 'story' || endSceneIds === null) return [];
    const live = new Set(endSceneIds);
    return this.outbound().filter((c) => c.from.kind === 'story' && !live.has(c.from.sceneId));
  });

  protected readonly selectedEntryScene = computed<string>(() => {
    const to = this.connection()?.to;
    return to?.kind === 'story' ? (to.sceneId ?? '') : '';
  });

  constructor() {
    let seq = 0;
    effect(() => {
      const source = this.source();
      this.reload();
      const mySeq = ++seq;
      untracked(() => void this.load(source, mySeq, () => mySeq === seq));
    });
  }

  private async load(
    source: ConnectionSource,
    _seq: number,
    isCurrent: () => boolean,
  ): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.connections.outboundFor(sourceEntityRef(source));
      if (!isCurrent()) return;
      this.outbound.set(rows);
      const conn =
        rows.find((c) =>
          source.kind === 'story'
            ? c.from.kind === 'story' && c.from.sceneId === source.sceneId
            : c.from.kind === 'event',
        ) ?? null;
      await this.resolveTarget(conn, isCurrent);
    } finally {
      if (isCurrent()) this.loading.set(false);
    }
  }

  private async resolveTarget(conn: Connection | null, isCurrent: () => boolean): Promise<void> {
    const ref = targetEntityRef(conn?.to ?? null);
    if (!conn || !ref) {
      this.targetRow.set(null);
      this.entryOptions.set(null);
      return;
    }
    const universeId = this.universes.activeUniverseId();
    if (!universeId) return;
    const rows = await this.directory.byIds({ universeId, refs: [ref], includeDrafts: true });
    if (!isCurrent()) return;
    this.targetRow.set(rows.find((r) => r.kind === ref.kind && r.id === ref.id) ?? null);
    if (conn.to?.kind === 'story' && rows.length > 0) {
      const content = await this.stories.getStoryContent(conn.to.storyId);
      if (!isCurrent()) return;
      if (!content) {
        this.entryOptions.set(null);
        return;
      }
      const options: EntrySceneOption[] = [];
      for (const [id, scene] of Object.entries(content.scenes)) {
        if (id !== content.defaultEntrySceneId && !scene.isEntry) continue;
        options.push({ id, label: scene.label?.trim() || id.slice(0, 8) });
      }
      this.entryOptions.set(options);
    } else {
      this.entryOptions.set(null);
    }
  }

  protected async onTargetPicked(refs: EntityRef[]): Promise<void> {
    const ref = refs.find((r) => r.kind === 'story' || r.kind === 'event') as
      | EntityRef<'story' | 'event'>
      | undefined;
    if (!ref) return;
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    const universeId = this.universes.activeUniverseId();
    const rows = universeId
      ? await this.directory.byIds({ universeId, refs: [ref], includeDrafts: true })
      : [];
    const snapshotTitle = rows[0]?.label;
    const to: ConnectionTarget =
      ref.kind === 'story' ? { kind: 'story', storyId: ref.id } : { kind: 'event', eventId: ref.id };
    const existing = this.connection();
    if (existing) {
      await this.connections.updateConnection(existing.id, { to, snapshotTitle }, uid);
    } else {
      await this.connections.wire(
        { from: this.source(), to, visibility: 'reader', snapshotTitle },
        uid,
      );
    }
    this.adding.set(false);
    this.retargeting.set(false);
    this.reload.update((n) => n + 1);
  }

  protected async savePending(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    await this.connections.wire({ from: this.source(), to: null, visibility: 'reader' }, uid);
    this.adding.set(false);
    this.reload.update((n) => n + 1);
  }

  protected async makePending(): Promise<void> {
    const existing = this.connection();
    const uid = this.auth.user()?.uid;
    if (!existing || !uid) return;
    await this.connections.updateConnection(existing.id, { to: null }, uid);
    this.retargeting.set(false);
    this.reload.update((n) => n + 1);
  }

  protected async onVisibility(visibility: ConnectionVisibility): Promise<void> {
    const existing = this.connection();
    const uid = this.auth.user()?.uid;
    if (!existing || !uid || existing.visibility === visibility) return;
    await this.connections.updateConnection(existing.id, { visibility }, uid);
    this.reload.update((n) => n + 1);
  }

  protected async onNote(event: Event): Promise<void> {
    const existing = this.connection();
    const uid = this.auth.user()?.uid;
    if (!existing || !uid) return;
    const value = (event.target as HTMLInputElement).value.trim();
    await this.connections.updateConnection(existing.id, { note: value || undefined }, uid);
    this.reload.update((n) => n + 1);
  }

  protected async onEntryScene(event: Event): Promise<void> {
    const existing = this.connection();
    const uid = this.auth.user()?.uid;
    if (!existing || !uid || existing.to?.kind !== 'story') return;
    const value = (event.target as HTMLSelectElement).value;
    const to: ConnectionTarget = {
      kind: 'story',
      storyId: existing.to.storyId,
      ...(value ? { sceneId: value } : {}),
    };
    await this.connections.updateConnection(
      existing.id,
      { to, snapshotTitle: existing.snapshotTitle },
      uid,
    );
    this.reload.update((n) => n + 1);
  }

  protected async remove(): Promise<void> {
    const existing = this.connection();
    if (!existing) return;
    await this.connections.deleteConnection(existing.id);
    this.reload.update((n) => n + 1);
  }

  protected async removeStale(id: string): Promise<void> {
    await this.connections.deleteConnection(id);
    this.reload.update((n) => n + 1);
  }

  protected staleSceneLabel(stale: Connection): string {
    if (stale.from.kind !== 'story') return endpointEntityId(stale.from);
    return this.sceneLabels()[stale.from.sceneId] ?? stale.from.sceneId.slice(0, 8);
  }
}
