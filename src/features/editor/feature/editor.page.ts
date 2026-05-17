import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  PLATFORM_ID,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { CalendarService, validateInGameDate } from '@features/calendar';
import { CharactersService } from '@features/characters';
import { EventsService } from '@features/events';
import { MediaAssetsService } from '@features/media';
import { PlacesService } from '@features/places';
import { StoriesService } from '@features/stories';
import { PrimaryButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import { EditorStore } from '../data-access/editor.store';
import { HasUnsavedChanges } from '../data-access/unsaved-changes.guard';
import { ConnectionEvent, MoveEvent, ReteCanvasComponent } from '../ui/rete-canvas.component';
import {
  ChoiceLabelUpdate,
  ChoiceReorder,
  SceneEditorPanelComponent,
  SceneUpdate,
} from '../ui/scene-editor-panel.component';
import { StoryMetaPanelComponent } from '../ui/story-meta-panel.component';
import editorEn from '../i18n/en.json';
import editorUk from '../i18n/uk.json';

@Component({
  selector: 'app-editor-page',
  imports: [
    RouterLink,
    ReteCanvasComponent,
    SceneEditorPanelComponent,
    StoryMetaPanelComponent,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
    TranslocoDirective,
  ],
  providers: [
    EditorStore,
    provideTranslocoScope({
      scope: 'editor',
      loader: {
        en: () => Promise.resolve(editorEn),
        uk: () => Promise.resolve(editorUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'editor'">
      @if (store.loading()) {
        <p>{{ t('message.loading') }}</p>
      } @else if (store.error(); as err) {
        <p class="error">{{ err }}</p>
        <p><a routerLink="/library">{{ t('action.backToStories') }}</a></p>
      } @else if (store.storyId()) {
        <header class="bar">
          <h1>
            {{ store.meta()?.title || t('message.untitledStory') }}
            @if (store.meta()?.draft) {
              <span class="status status--draft" [title]="t('message.draftStatusTitle')">{{ t('field.draftBadge') }}</span>
            } @else {
              <span class="status status--published" [title]="t('message.publishedStatusTitle')">
                {{ t('field.publishedBadge') }}
              </span>
            }
            @if (store.dirty()) {
              <span class="dirty" [title]="t('message.unsavedChanges')">●</span>
            }
          </h1>
          <button uiSecondary type="button" (click)="store.addScene()">{{ t('action.addScene') }}</button>
          <button
            uiPrimary
            type="button"
            [disabled]="!store.dirty() || !store.metaValid() || dateInvalid()"
            [loading]="store.saving()"
            (click)="store.save()"
          >
            {{ t('action.save') }}
          </button>
        </header>

        @if (store.orphanSceneIds().length; as count) {
          <aside class="orphans" role="status">
            <strong>{{ t('message.orphansCountWord', { count }) }}</strong>
            {{ t('message.orphansSuffix') }}
            @for (id of store.orphanSceneIds(); track id) {
              <button
                type="button"
                class="orphan-chip"
                [title]="id"
                (click)="store.selectScene(id)"
              >
                {{ sceneLabels()[id] }}
              </button>
            }
          </aside>
        }

        <div class="layout">
          <app-story-meta-panel
            [meta]="store.meta()"
            (update)="store.updateMeta($event)"
          />

          <app-rete-canvas
            [scenes]="store.scenes()"
            (move)="onMove($event)"
            (selectScene)="store.selectScene($event)"
            (connect)="onConnect($event)"
            (disconnect)="onDisconnect($event)"
          />

          <app-scene-editor-panel
            [sceneId]="store.selectedSceneId()"
            [scene]="store.selectedScene()"
            [isStartScene]="isSelectedStart()"
            [characterOptions]="characterOptions()"
            [placeOptions]="placeOptions()"
            [characterSprites]="characterSprites()"
            [sceneLabels]="sceneLabels()"
            (update)="onUpdate($event)"
            (updateChoiceLabel)="onChoiceLabel($event)"
            (reorderChoices)="onReorderChoices($event)"
            (remove)="store.removeScene($event)"
            (setAsStart)="store.setStartScene($event)"
          />
        </div>
      }
    </ng-container>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .bar h1 {
      flex: 1;
      margin: 0;
      font-size: 1.25rem;
    }
    .dirty {
      color: var(--color-danger-foreground);
      margin-left: 0.5rem;
    }
    .status {
      display: inline-block;
      margin-left: 0.5rem;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      vertical-align: middle;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .status--draft {
      background: var(--color-warning);
      color: var(--color-warning-foreground);
    }
    .status--published {
      background: var(--color-success);
      color: var(--color-success-foreground);
    }
    .error {
      color: var(--color-danger-foreground);
    }
    .orphans {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.75rem;
      border: 1px solid var(--color-warning-border);
      background: var(--color-warning);
      border-radius: 0.375rem;
      color: var(--color-warning-foreground);
      font-size: 0.875rem;
      flex-shrink: 0;
    }
    .orphan-chip {
      font: inherit;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      padding: 0.125rem 0.5rem;
      border: 1px solid var(--color-warning-border);
      border-radius: 0.25rem;
      background: var(--color-warning);
      color: var(--color-warning-foreground);
      cursor: pointer;
    }
    .orphan-chip:hover {
      background: var(--color-surface-muted);
    }
    .layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      flex: 1;
      min-height: 0;
    }
    .layout > * {
      min-height: 0;
      overflow: auto;
    }
    .layout app-rete-canvas {
      min-height: 60vh;
    }
    @media (min-width: 1024px) {
      .layout {
        grid-template-columns: 280px 1fr 320px;
      }
      .layout > * {
        height: 100%;
      }
      .layout app-rete-canvas {
        min-height: 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPage implements HasUnsavedChanges {
  readonly id = input.required<string>();
  protected readonly store = inject(EditorStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);
  private readonly events = inject(EventsService);
  private readonly stories = inject(StoriesService);
  private readonly media = inject(MediaAssetsService);
  private readonly calendarService = inject(CalendarService);

  protected readonly dateInvalid = computed(() => {
    const meta = this.store.meta();
    if (!meta) return false;
    return validateInGameDate(meta.inGameDate, this.calendarService.calendar()).length > 0;
  });

  protected readonly isSelectedStart = computed(
    () => this.store.selectedSceneId() !== null
      && this.store.selectedSceneId() === this.store.startSceneId(),
  );

  protected readonly characterOptions = computed(() =>
    this.characters
      .characters()
      .map((c) => ({ id: c.id, label: c.name, hint: c.slug, kind: 'character' as const })),
  );
  protected readonly placeOptions = computed(() =>
    this.places
      .places()
      .map((p) => ({ id: p.id, label: p.name, hint: p.slug, kind: 'place' as const })),
  );
  protected readonly characterSprites = computed<Record<string, { id: string; label: string }[]>>(
    () => {
      const map: Record<string, { id: string; label: string }[]> = {};
      for (const c of this.characters.characters()) {
        const ids = c.sprites ?? [];
        if (ids.length === 0) continue;
        const resolved = ids
          .map((id) => this.media.byId(id))
          .filter((a): a is NonNullable<typeof a> => !!a)
          .map((a) => ({ id: a.id, label: a.label }));
        if (resolved.length) map[c.id] = resolved;
      }
      return map;
    },
  );
  protected readonly sceneLabels = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const [id, scene] of Object.entries(this.store.scenes())) {
      map[id] = scene.label?.trim() || this.shortId(id);
    }
    return map;
  });

  constructor() {
    this.store.bindLoad(this.id);

    if (this.isBrowser) {
      const beforeUnload = (event: BeforeUnloadEvent) => {
        if (this.store.dirty()) {
          event.preventDefault();
          event.returnValue = '';
        }
      };
      window.addEventListener('beforeunload', beforeUnload);

      const keydown = (event: KeyboardEvent) => this.onKeydown(event);
      window.addEventListener('keydown', keydown);

      this.destroyRef.onDestroy(() => {
        window.removeEventListener('beforeunload', beforeUnload);
        window.removeEventListener('keydown', keydown);
      });
    }
  }

  private onKeydown(event: KeyboardEvent): void {
    if (!this.store.storyId()) return;

    if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
      event.preventDefault();
      if (this.store.dirty() && this.store.metaValid() && !this.store.saving()) {
        void this.store.save();
      }
      return;
    }

    if (isEditableTarget(event.target)) return;

    if (event.key === 'Delete') {
      const id = this.store.selectedSceneId();
      if (!id) return;
      if (id === this.store.startSceneId()) return;
      event.preventDefault();
      this.store.removeScene(id);
      return;
    }

    if (event.key === 'n' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.store.addScene();
    }
  }

  hasUnsavedChanges(): boolean {
    return this.store.dirty();
  }

  protected onMove(event: MoveEvent): void {
    this.store.moveScene(event.sceneId, event.position);
  }

  protected onConnect(event: ConnectionEvent): void {
    this.store.addConnection(event.from, event.to);
  }

  protected onDisconnect(event: ConnectionEvent): void {
    this.store.removeConnection(event.from, event.to);
  }

  protected onUpdate(event: SceneUpdate): void {
    this.store.updateScene(event.id, event.patch);
  }

  protected onChoiceLabel(event: ChoiceLabelUpdate): void {
    this.store.updateChoiceLabel(event.fromSceneId, event.toSceneId, event.label);
  }

  protected onReorderChoices(event: ChoiceReorder): void {
    this.store.reorderChoices(event.sceneId, event.fromIndex, event.toIndex);
  }

  protected shortId(id: string): string {
    return id.length > 12 ? `${id.slice(0, 8)}…` : id;
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
