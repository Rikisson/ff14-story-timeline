import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { Story, StoriesService } from '@features/stories';
import { UniverseStore } from '@features/universes';
import { createEntityDirectoryQueryStore } from '@shared/data-access';
import {
  ArchivesSelectorComponent,
  EntityListPaneComponent,
  ListPaneItem,
  PageComponent,
} from '@shared/ui';
import { StoryDetailComponent } from '../ui/story-detail.component';
import storyEn from '../i18n/en.json';
import storyUk from '../i18n/uk.json';

@Component({
  selector: 'app-stories-page',
  host: { class: 'block h-full' },
  imports: [
    ArchivesSelectorComponent,
    StoryDetailComponent,
    EntityListPaneComponent,
    PageComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'story',
      loader: {
        en: () => Promise.resolve(storyEn),
        uk: () => Promise.resolve(storyUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'story'">
      <app-page class="h-full">
        @if (actionError(); as e) {
          <p class="m-0 text-sm text-danger-foreground">{{ e }}</p>
        }

        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-entity-list-pane
            class="md:w-80 md:shrink-0"
            [kind]="'story'"
            [items]="listItems()"
            [selectedId]="selectedId()"
            [hasMore]="directory.hasMore()"
            [loadingMore]="directory.loadingMore()"
            [loading]="directory.loading()"
            [error]="directory.error()"
            [canCreate]="canCreate()"
            [createLabel]="t('action.newStory')"
            [emptyMessage]="t('empty.list')"
            [ariaLabel]="t('tooltip.storiesList')"
            [searchable]="true"
            [searchValue]="search()"
            (searchChange)="search.set($event)"
            (select)="onSelect($event)"
            (create)="createStory()"
            (loadMore)="directory.loadMore()"
          >
            <app-archives-selector list-title />
          </app-entity-list-pane>

          <section class="flex min-h-0 flex-col md:flex-1" [attr.aria-label]="t('tooltip.storyDetails')">
            @if (selected(); as s) {
              <div class="min-h-0 flex-1 overflow-y-auto">
                <app-story-detail
                  [story]="s"
                  [canEdit]="canCreate()"
                  (remove)="deleteStory($event)"
                />
              </div>
            } @else {
              <p class="m-0 rounded-lg border border-border bg-surface-subtle px-4 py-12 text-center text-sm text-foreground-faint">
                {{ t('empty.selectStory') }}
              </p>
            }
          </section>
        </div>
      </app-page>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoriesPage {
  protected readonly stories = inject(StoriesService);
  private readonly universes = inject(UniverseStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  protected readonly user = inject(AuthStore).user;

  protected readonly canCreate = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  // Members see drafts (alongside the *Draft* pill); public reads omit
  // them. The directory rule enforces visibility, but the query must
  // include the predicate explicitly for guests.
  private readonly memberView = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly directory = createEntityDirectoryQueryStore({
    universeId: computed(() => this.universes.activeUniverseId()),
    kind: computed(() => 'story' as const),
    includeDrafts: this.memberView,
  });

  protected readonly creating = signal(false);
  protected readonly actionError = signal<string | null>(null);
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly selectedId = computed(() => this.routeId().get('id') ?? null);

  // Selected story is lazy-fetched by ID — the list pane carries
  // projection metadata only.
  private readonly selectedStory = signal<Story | null>(null);

  protected readonly selected = this.selectedStory.asReadonly();

  protected readonly search = signal('');

  protected readonly listItems = computed<ListPaneItem[]>(() => {
    const q = this.search().trim().toLowerCase();
    return this.directory
      .rows()
      .map((row) => ({
        id: row.id,
        label: row.label || this.transloco.translate('story.field.untitled'),
        secondary: row.secondary,
        coverAssetId: row.coverAssetId,
        badge: row.draft
          ? { text: this.transloco.translate('story.field.draft'), tone: 'amber' as const }
          : undefined,
      }))
      .filter((item) => q === '' || item.label.toLowerCase().includes(q));
  });

  constructor() {
    let fetchSeq = 0;
    effect(() => {
      const id = this.selectedId();
      if (!id) {
        this.selectedStory.set(null);
        return;
      }
      // Re-fetch on universe change so a stale story from the previous
      // universe doesn't render.
      this.universes.activeUniverseId();
      const seq = ++fetchSeq;
      void this.stories.getStory(id).then((s) => {
        if (seq !== fetchSeq) return;
        this.selectedStory.set(s ?? null);
      });
    });
  }

  protected onSelect(id: string): void {
    void this.router.navigate(['/stories', id]);
  }

  protected async createStory(): Promise<void> {
    const u = this.user();
    if (!u || this.creating()) return;
    this.creating.set(true);
    this.actionError.set(null);
    try {
      const id = await this.stories.createDraftStory(u.uid);
      await this.router.navigate(['/edit', id]);
    } catch (err) {
      this.actionError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
    } finally {
      this.creating.set(false);
    }
  }

  protected async deleteStory(id: string): Promise<void> {
    try {
      await this.stories.deleteStory(id);
    } catch (err) {
      this.actionError.set(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      return;
    }
    if (this.selectedId() === id) {
      void this.router.navigate(['/stories']);
    }
    void this.directory.refresh();
  }
}
