import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Character, CharacterDraft, CharactersService } from '@features/characters';
import { createEntityListController } from '@shared/data-access';
import { EntityListPaneComponent, ListPaneItem } from '@shared/ui';
import { CharacterCardComponent } from '../ui/character-card.component';
import { CharacterFormComponent } from '../ui/character-form.component';
import { PortraitLibraryComponent } from '../ui/portrait-library.component';

@Component({
  selector: 'app-characters-page',
  imports: [
    CharacterCardComponent,
    CharacterFormComponent,
    EntityListPaneComponent,
    PortraitLibraryComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <h1 class="m-0 text-2xl font-semibold text-slate-900">Characters</h1>

      <div class="grid gap-4 md:grid-cols-[320px_1fr]">
        <app-entity-list-pane
          [items]="listItems()"
          [selectedId]="ctrl.selectedId()"
          [hasMore]="service.hasMore()"
          [loadingMore]="service.loadingMore()"
          [canCreate]="ctrl.canCreate()"
          createLabel="+ Add character"
          emptyMessage="No characters yet."
          ariaLabel="Characters list"
          (select)="onSelect($event)"
          (create)="ctrl.startCreate()"
          (loadMore)="service.loadMore()"
        />

        <section class="flex flex-col gap-3" aria-label="Character details">
          @if (ctrl.mode().kind === 'create' || ctrl.mode().kind === 'edit') {
            <app-character-form
              [initial]="ctrl.editingDraft()"
              [busy]="ctrl.busy()"
              [errorMessage]="ctrl.errorMessage()"
              (submitted)="ctrl.submit($event)"
              (cancelled)="ctrl.cancel()"
            />
            @if (ctrl.editing(); as c) {
              <app-character-portrait-library
                [characterId]="c.id"
                [portraits]="c.portraits ?? []"
              />
            }
          } @else if (ctrl.selected(); as c) {
            <app-character-card
              [character]="c"
              [canEdit]="ctrl.canCreate()"
              (edit)="ctrl.startEdit(c)"
              (remove)="ctrl.confirmRemove(c)"
            />
            <app-character-portrait-library
              [characterId]="c.id"
              [portraits]="c.portraits ?? []"
            />
          } @else {
            <p class="m-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              Select a character to view details.
            </p>
          }
        </section>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharactersPage {
  protected readonly service = inject(CharactersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly characters = this.service.characters;
  private readonly routeId = toSignal(this.route.paramMap, { requireSync: true });

  protected readonly ctrl = createEntityListController<Character, CharacterDraft>({
    entities: this.characters,
    service: this.service,
    toDraft: (c) => ({ slug: c.slug, name: c.name, race: c.race, job: c.job }),
    removeLabel: (c) => c.name,
  });

  protected readonly listItems = computed<ListPaneItem[]>(() =>
    this.characters().map((c) => ({
      id: c.id,
      label: c.name,
      secondary: [c.race, c.job].filter(Boolean).join(' · ') || undefined,
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
