import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Character, CharacterDraft, CharactersService } from '@features/characters';
import { createEntityListController } from '@shared/data-access';
import { PrimaryButtonComponent } from '@shared/ui';
import { CharacterCardComponent } from '../ui/character-card.component';
import { CharacterFormComponent } from '../ui/character-form.component';
import { PortraitLibraryComponent } from '../ui/portrait-library.component';

@Component({
  selector: 'app-characters-page',
  imports: [
    PrimaryButtonComponent,
    CharacterCardComponent,
    CharacterFormComponent,
    PortraitLibraryComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="m-0 text-2xl font-semibold text-slate-900">Characters</h1>
        @if (ctrl.canCreate() && ctrl.mode().kind === 'idle') {
          <button uiPrimary type="button" (click)="ctrl.startCreate()">+ Add character</button>
        }
      </div>

      @if (ctrl.mode().kind !== 'idle') {
        <app-character-form
          [initial]="ctrl.editingDraft()"
          [busy]="ctrl.busy()"
          [errorMessage]="ctrl.errorMessage()"
          (submitted)="ctrl.submit($event)"
          (cancelled)="ctrl.cancel()"
        />
      }

      @if (ctrl.editing(); as c) {
        <app-character-portrait-library
          [characterId]="c.id"
          [portraits]="c.portraits ?? []"
        />
      }

      @if (characters().length === 0) {
        <p class="text-slate-600">No characters yet.</p>
      } @else {
        <ul class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] justify-start gap-4">
          @for (c of characters(); track c.id) {
            <li>
              <app-character-card
                [character]="c"
                [canEdit]="ctrl.canCreate()"
                (edit)="ctrl.startEdit(c)"
                (remove)="ctrl.confirmRemove(c)"
              />
            </li>
          }
        </ul>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharactersPage {
  private readonly service = inject(CharactersService);
  protected readonly characters = this.service.characters;

  protected readonly ctrl = createEntityListController<Character, CharacterDraft>({
    entities: this.characters,
    service: this.service,
    toDraft: (c) => ({ slug: c.slug, name: c.name, race: c.race, job: c.job }),
    removeLabel: (c) => c.name,
  });
}
