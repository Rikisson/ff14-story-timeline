import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { provideTranslocoScope, TranslocoDirective } from '@jsverse/transloco';
import { AuthStore } from '@features/auth';
import { Character, CharacterDraft, CharactersService } from '@features/characters';
import { UniverseStore } from '@features/universes';
import {
  createEntityDirectoryQueryStore,
  createEntityListController,
} from '@shared/data-access';
import {
  EntityListPaneComponent,
  ListPaneItem,
  PageComponent,
  PageHeaderComponent,
} from '@shared/ui';
import { CharacterCardComponent } from '../ui/character-card.component';
import { CharacterFormComponent } from '../ui/character-form.component';
import { SpriteLibraryComponent } from '../ui/sprite-library.component';
import characterEn from '../i18n/en.json';
import characterUk from '../i18n/uk.json';

@Component({
  selector: 'app-characters-page',
  host: { class: 'block h-full' },
  imports: [
    CharacterCardComponent,
    CharacterFormComponent,
    EntityListPaneComponent,
    PageComponent,
    PageHeaderComponent,
    SpriteLibraryComponent,
    TranslocoDirective,
  ],
  providers: [
    provideTranslocoScope({
      scope: 'character',
      loader: {
        en: () => Promise.resolve(characterEn),
        uk: () => Promise.resolve(characterUk),
      },
    }),
  ],
  template: `
    <ng-container *transloco="let t; prefix: 'character'">
      <app-page class="h-full">
        <app-page-header
          [title]="t('field.pageTitle')"
          [subtitle]="t('field.pageSubtitle')"
        />

        <div class="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
          <app-entity-list-pane
            class="md:w-80 md:shrink-0"
            [kind]="'character'"
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
            (select)="onSelect($event)"
            (create)="ctrl.startCreate()"
            (loadMore)="directory.loadMore()"
          />

          <section class="flex min-h-0 flex-col md:flex-1" [attr.aria-label]="t('tooltip.details')">
            @if (ctrl.mode().kind === 'create' || ctrl.mode().kind === 'edit') {
              <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                <app-character-form
                  [initial]="ctrl.editingDraft()"
                  [busy]="ctrl.busy()"
                  [errorMessage]="ctrl.errorMessage()"
                  (submitted)="ctrl.submit($event)"
                  (cancelled)="ctrl.cancel()"
                />
                @if (ctrl.editing(); as c) {
                  <app-character-sprite-library
                    [characterId]="c.id"
                    [sprites]="c.sprites ?? []"
                  />
                }
              </div>
            } @else if (ctrl.selected(); as c) {
              <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <app-character-card
                  [character]="c"
                  [canEdit]="ctrl.canCreate()"
                  (edit)="ctrl.startEdit(c)"
                  (remove)="ctrl.confirmRemove(c)"
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
export class CharactersPage {
  protected readonly service = inject(CharactersService);
  private readonly universes = inject(UniverseStore);
  private readonly user = inject(AuthStore).user;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

  // Members see drafts (and the rule short-circuits `visiblePublic` for
  // them); guests must include `where('visiblePublic', '==', true)` or
  // the rule rejects the whole query. Derive from membership rather
  // than hard-coding `true`.
  private readonly memberView = computed(
    () => !!this.user() && this.universes.isMemberOfActive(),
  );

  protected readonly directory = createEntityDirectoryQueryStore({
    universeId: computed(() => this.universes.activeUniverseId()),
    kind: computed(() => 'character' as const),
    includeDrafts: this.memberView,
  });

  protected readonly ctrl = createEntityListController<Character, CharacterDraft>({
    service: this.service,
    kind: 'character',
    lookupById: (id) => this.service.getById(id),
    toDraft: (c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      coverAssetId: c.coverAssetId,
      relatedRefs: c.relatedRefs,
    }),
    removeLabel: (c) => c.name,
  });

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.directory.rows().map((row) => ({
      id: row.id,
      label: row.label,
      secondary: row.secondary,
      coverAssetId: row.coverAssetId,
    })),
  );

  constructor() {
    effect(() => {
      const id = this.routeId().get('id');
      this.ctrl.select(id ?? null);
    });

    effect(() => {
      const id = this.ctrl.selectedId();
      const current = this.routeId().get('id') ?? null;
      if (id !== current) {
        void this.router.navigate(id ? ['/characters', id] : ['/characters'], {
          replaceUrl: true,
        });
      }
    });
  }

  protected onSelect(id: string): void {
    void this.router.navigate(['/characters', id]);
  }
}
