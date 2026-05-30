import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { UniverseStore } from '@features/universes';
import {
  createEntityDirectoryQueryStore,
  createEntityListController,
} from '@shared/data-access';
import {
  ArchivesHeaderComponent,
  EntityListPaneComponent,
  ListPaneItem,
  PageComponent,
} from '@shared/ui';
import { CodexCategoriesService } from '../data-access/codex-categories.service';
import { CodexEntriesService } from '../data-access/codex-entries.service';
import { CodexEntry, CodexEntryDraft } from '../data-access/codex-entry.types';
import { CodexCategoryTypeaheadComponent } from '../ui/codex-category-typeahead.component';
import { CodexEntryCardComponent } from '../ui/codex-entry-card.component';
import { CodexEntryFormComponent } from '../ui/codex-entry-form.component';
import codexEn from '../i18n/en.json';
import codexUk from '../i18n/uk.json';

@Component({
  selector: 'app-codex-page',
  host: { class: 'block h-full' },
  imports: [
    ArchivesHeaderComponent,
    CodexCategoryTypeaheadComponent,
    EntityListPaneComponent,
    CodexEntryCardComponent,
    CodexEntryFormComponent,
    PageComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'codex',
      loader: {
        en: () => Promise.resolve(codexEn),
        uk: () => Promise.resolve(codexUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'codex'">
      <app-page class="h-full">
        <app-archives-header />

        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-entity-list-pane
            class="md:w-80 md:shrink-0"
            [kind]="'codexEntry'"
            [items]="listItems()"
            [selectedId]="ctrl.selectedId()"
            [hasMore]="directory.hasMore()"
            [loadingMore]="directory.loadingMore()"
            [loading]="directory.loading()"
            [error]="directory.error()"
            [canCreate]="ctrl.canCreate()"
            [createLabel]="t('action.create')"
            [emptyMessage]="t('empty.list')"
            [ariaLabel]="t('tooltip.list')"
            [searchable]="true"
            [searchValue]="search()"
            [hasFilters]="true"
            [filtersActive]="categoryFilter() !== null"
            (searchChange)="search.set($event)"
            (select)="onSelect($event)"
            (create)="ctrl.startCreate()"
            (loadMore)="directory.loadMore()"
          >
            <label list-filters class="flex flex-col gap-1">
              <span class="text-xs font-medium text-foreground-subtle">{{ t('field.category') }}</span>
              <app-codex-category-typeahead
                [value]="categoryFilter()"
                [allowCreate]="false"
                [placeholder]="t('action.filterByCategory')"
                (valueChange)="categoryFilter.set($event)"
              />
            </label>
          </app-entity-list-pane>

          <section class="flex min-h-0 flex-col md:flex-1" [attr.aria-label]="t('tooltip.details')">
            @if (ctrl.mode().kind === 'create' || ctrl.mode().kind === 'edit') {
              <div class="min-h-0 flex-1 overflow-y-auto">
                <app-codex-entry-form
                  [initial]="ctrl.editingDraft()"
                  [busy]="ctrl.busy()"
                  [errorMessage]="ctrl.errorMessage()"
                  (submitted)="ctrl.submit($event)"
                  (cancelled)="ctrl.cancel()"
                />
              </div>
            } @else if (ctrl.selected(); as e) {
              <div class="min-h-0 flex-1 overflow-y-auto">
                <app-codex-entry-card
                  [entry]="e"
                  [canEdit]="ctrl.canCreate()"
                  (edit)="ctrl.startEdit(e)"
                  (remove)="ctrl.confirmRemove(e)"
                />
              </div>
            } @else {
              <p class="m-0 rounded-lg border border-border bg-surface-subtle px-4 py-12 text-center text-sm text-foreground-faint">
                {{ t('empty.selectDetail') }}
              </p>
            }
          </section>
        </div>
      </app-page>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodexPage {
  protected readonly service = inject(CodexEntriesService);
  private readonly universes = inject(UniverseStore);
  private readonly user = inject(AuthStore).user;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

  private readonly memberView = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly categoryFilter = signal<string | null>(null);
  protected readonly search = signal('');

  protected readonly directory = createEntityDirectoryQueryStore({
    universeId: computed(() => this.universes.activeUniverseId()),
    kind: computed(() => 'codexEntry' as const),
    includeDrafts: this.memberView,
    categoryKey: this.categoryFilter,
  });

  protected readonly ctrl = createEntityListController<CodexEntry, CodexEntryDraft>({
    service: this.service,
    lookupById: (id) => this.service.getById(id),
    toDraft: (e) => ({
      slug: e.slug,
      title: e.title,
      categoryKey: e.categoryKey,
      description: e.description,
      coverAssetId: e.coverAssetId,
      relatedRefs: e.relatedRefs,
    }),
    removeLabel: (e) => e.title,
  });

  private readonly categories = inject(CodexCategoriesService);

  protected readonly listItems = computed<ListPaneItem[]>(() => {
    const byKey = this.categories.categoryByKey();
    const q = this.search().trim().toLowerCase();
    return this.directory
      .rows()
      .map((row) => ({
        id: row.id,
        label: row.label,
        // Codex surfaces have the categories config hydrated already, so the
        // live label resolves locally from `categoryKey`. Cross-kind surfaces
        // (which don't hold the config) fall back to the projection's
        // denormalized `secondary`.
        secondary: row.categoryKey ? byKey.get(row.categoryKey)?.label : row.secondary,
        coverAssetId: row.coverAssetId,
      }))
      .filter((item) => q === '' || item.label.toLowerCase().includes(q));
  });

  constructor() {
    effect(() => {
      const id = this.routeId().get('id');
      this.ctrl.select(id ?? null);
    });

    effect(() => {
      const id = this.ctrl.selectedId();
      const current = this.routeId().get('id') ?? null;
      if (id !== current) {
        void this.router.navigate(id ? ['/codex', id] : ['/codex'], {
          replaceUrl: true,
        });
      }
    });
  }

  protected onSelect(id: string): void {
    void this.router.navigate(['/codex', id]);
  }
}
