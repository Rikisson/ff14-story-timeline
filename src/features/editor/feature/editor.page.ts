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

      <div class="layout">
        <app-story-meta-panel
          [meta]="store.meta()"
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
    .error {
      color: #b00020;
    }
    .layout {
      display: grid;
      grid-template-columns: 280px 1fr 320px;
      gap: 1rem;
      flex: 1;
      min-height: 0;
    }
    .layout > * {
      min-height: 0;
      height: 100%;
      overflow: auto;
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
      const handler = (event: BeforeUnloadEvent) => {
        if (this.store.dirty()) {
          event.preventDefault();
          event.returnValue = '';
        }
      };
      window.addEventListener('beforeunload', handler);
      this.destroyRef.onDestroy(() => window.removeEventListener('beforeunload', handler));
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
}
