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
import { CharacterPortrait, CharactersService } from '@features/characters';
import { EventsService } from '@features/events';
import { PlacesService } from '@features/places';
import { StoriesService } from '@features/stories';
import { PrimaryButtonComponent, SecondaryButtonComponent } from '@shared/ui';
import { InlineRefOption } from '@shared/utils';
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

@Component({
  selector: 'app-editor-page',
  imports: [
    RouterLink,
    ReteCanvasComponent,
    SceneEditorPanelComponent,
    StoryMetaPanelComponent,
    PrimaryButtonComponent,
    SecondaryButtonComponent,
  ],
  providers: [EditorStore],
  template: `
    @if (store.loading()) {
      <p>Loading...</p>
    } @else if (store.error(); as err) {
      <p class="error">{{ err }}</p>
      <p><a routerLink="/" [queryParams]="{ mineOnly: 'true' }">Back to my stories</a></p>
    } @else if (store.storyId()) {
      <header class="bar">
        <h1>
          {{ store.meta()?.title || 'Untitled story' }}
          @if (store.meta()?.draft) {
            <span class="status status--draft" title="This story is a draft">Draft</span>
          } @else {
            <span class="status status--published" title="This story is published">
              Published
            </span>
          }
          @if (store.dirty()) {
            <span class="dirty" title="Unsaved changes">●</span>
          }
        </h1>
        <button uiSecondary type="button" (click)="store.addScene()">+ Add scene</button>
        <button
          uiPrimary
          type="button"
          [disabled]="!store.dirty() || !store.metaValid()"
          [loading]="store.saving()"
          (click)="store.save()"
        >
          Save
        </button>
      </header>

      @if (store.orphanSceneIds().length; as count) {
        <aside class="orphans" role="status">
          <strong>{{ count }} orphan {{ count === 1 ? 'scene' : 'scenes' }}</strong>
          unreachable from the start scene:
          @for (id of store.orphanSceneIds(); track id) {
            <button type="button" class="orphan-chip" (click)="store.selectScene(id)">
              {{ shortId(id) }}
            </button>
          }
        </aside>
      }

      <div class="layout">
        <app-story-meta-panel
          [meta]="store.meta()"
          [storyId]="store.storyId() ?? ''"
          [characterOptions]="characterOptions()"
          [placeOptions]="placeOptions()"
          [inlineRefOptions]="inlineRefOptions()"
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
          [storyId]="store.storyId() ?? ''"
          [characterOptions]="characterOptions()"
          [placeOptions]="placeOptions()"
          [characterPortraits]="characterPortraits()"
          [inlineRefOptions]="inlineRefOptions()"
          (update)="onUpdate($event)"
          (updateChoiceLabel)="onChoiceLabel($event)"
          (reorderChoices)="onReorderChoices($event)"
          (remove)="store.removeScene($event)"
          (setAsStart)="store.setStartScene($event)"
        />
      </div>
    }
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
      color: #b00020;
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
      background: #fef3c7;
      color: #92400e;
    }
    .status--published {
      background: #dcfce7;
      color: #166534;
    }
    .error {
      color: #b00020;
    }
    .orphans {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      margin-bottom: 0.75rem;
      border: 1px solid #fbbf24;
      background: #fffbeb;
      border-radius: 0.375rem;
      color: #92400e;
      font-size: 0.875rem;
      flex-shrink: 0;
    }
    .orphan-chip {
      font: inherit;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      padding: 0.125rem 0.5rem;
      border: 1px solid #fbbf24;
      border-radius: 0.25rem;
      background: #fef3c7;
      color: #92400e;
      cursor: pointer;
    }
    .orphan-chip:hover {
      background: #fde68a;
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

  protected readonly isSelectedStart = computed(
    () => this.store.selectedSceneId() !== null
      && this.store.selectedSceneId() === this.store.startSceneId(),
  );

  protected readonly characterOptions = computed(() =>
    this.characters.characters().map((c) => ({ id: c.id, label: c.name, slug: c.slug })),
  );
  protected readonly placeOptions = computed(() =>
    this.places.places().map((p) => ({ id: p.id, label: p.name, slug: p.slug })),
  );
  protected readonly characterPortraits = computed<Record<string, CharacterPortrait[]>>(() => {
    const map: Record<string, CharacterPortrait[]> = {};
    for (const c of this.characters.characters()) {
      if (c.portraits?.length) map[c.id] = c.portraits;
    }
    return map;
  });
  protected readonly inlineRefOptions = computed<InlineRefOption[]>(() => [
    ...this.characters.characters().map((c) => ({
      kind: 'character' as const,
      id: c.id,
      label: c.name,
      slug: c.slug,
    })),
    ...this.places.places().map((p) => ({
      kind: 'place' as const,
      id: p.id,
      label: p.name,
      slug: p.slug,
    })),
    ...this.events.events().map((e) => ({
      kind: 'event' as const,
      id: e.id,
      label: e.name,
      slug: e.slug,
    })),
    ...this.stories.publishedStories().map((s) => ({
      kind: 'story' as const,
      id: s.id,
      label: s.title,
      slug: s.slug,
    })),
  ]);

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
