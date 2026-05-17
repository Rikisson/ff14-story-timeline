import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { Story, StoriesService } from '@features/stories';
import { UniverseStore } from '@features/universes';
import { createEntityDirectoryQueryStore } from '@shared/data-access';
import { EntityListPaneComponent, ListPaneItem, PageHeaderComponent } from '@shared/ui';
import { CatalogDetailComponent } from './catalog-detail.component';
import catalogEn from './i18n/en.json';
import catalogUk from './i18n/uk.json';

@Component({
  selector: 'app-catalog-page',
  host: { class: 'block h-full' },
  imports: [
    CatalogDetailComponent,
    EntityListPaneComponent,
    PageHeaderComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'catalog',
      loader: {
        en: () => Promise.resolve(catalogEn),
        uk: () => Promise.resolve(catalogUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'catalog'">
      <div class="flex h-full flex-col gap-4">
        <app-page-header
          [title]="t('field.title')"
          [subtitle]="t('message.subtitle')"
        />

        @if (actionError(); as e) {
          <p class="m-0 text-sm text-danger-foreground">{{ e }}</p>
        }

        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-entity-list-pane
            class="md:w-80 md:shrink-0"
            [items]="listItems()"
            [selectedId]="selectedId()"
            [hasMore]="directory.hasMore()"
            [loadingMore]="directory.loadingMore()"
            [canCreate]="canCreate()"
            [createLabel]="t('action.newStory')"
            [emptyMessage]="t('empty.list')"
            [ariaLabel]="t('tooltip.storiesList')"
            (select)="onSelect($event)"
            (create)="createStory()"
            (loadMore)="directory.loadMore()"
          />

          <section class="flex min-h-0 flex-col md:flex-1" [attr.aria-label]="t('tooltip.storyDetails')">
            @if (selected(); as s) {
              <div class="min-h-0 flex-1 overflow-y-auto">
                <app-catalog-detail
                  [story]="s"
                  [canEdit]="canCreate()"
                  (remove)="deleteStory($event)"
                />
              </div>
            } @else {
              <p class="m-0 rounded-lg border border-dashed border-border-strong bg-surface-subtle px-4 py-12 text-center text-sm text-foreground-faint">
                {{ t('empty.selectStory') }}
              </p>
            }
          </section>
        </div>
      </div>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPage {
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

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.directory.rows().map((row) => ({
      id: row.id,
      label: row.label || this.transloco.translate('catalog.field.untitled'),
      secondary: row.secondary,
      coverAssetId: row.coverAssetId,
      badge: row.draft
        ? { text: this.transloco.translate('catalog.field.draft'), tone: 'amber' }
        : undefined,
    })),
  );

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
    void this.router.navigate(['/library', id]);
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
      void this.router.navigate(['/library']);
    }
    void this.directory.refresh();
  }
}
