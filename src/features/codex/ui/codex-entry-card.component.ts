import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CharactersService } from '@features/characters';
import { EventsService } from '@features/events';
import { FactionsService } from '@features/factions';
import { ItemsService } from '@features/items';
import { PlacesService } from '@features/places';
import { PlotlinesService } from '@features/plotlines';
import { StoriesService } from '@features/stories';
import { EntityKind } from '@shared/models';
import { DangerButtonComponent, GhostButtonComponent } from '@shared/ui';
import { CodexEntriesService } from '../data-access/codex-entries.service';
import { CodexEntry } from '../data-access/codex-entry.types';

const KIND_LABEL: Record<EntityKind, string> = {
  character: 'Character',
  place: 'Place',
  event: 'Event',
  story: 'Story',
  plotline: 'Plotline',
  item: 'Item',
  faction: 'Faction',
  codexEntry: 'Codex',
};

@Component({
  selector: 'app-codex-entry-card',
  imports: [GhostButtonComponent, DangerButtonComponent],
  host: { class: 'block h-full' },
  template: `
    <article
      class="flex h-full flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div class="flex items-start justify-between gap-2">
        <h3 class="m-0 text-lg font-semibold text-slate-900">{{ entry().title }}</h3>
        @if (entry().category; as c) {
          <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            {{ c }}
          </span>
        }
      </div>

      <p class="m-0 line-clamp-4 whitespace-pre-line text-sm text-slate-700">
        {{ entry().body }}
      </p>

      @if (relatedLabels().length > 0) {
        <ul class="flex flex-wrap gap-1.5">
          @for (r of relatedLabels(); track r.key) {
            <li
              class="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-800"
            >
              <span class="font-semibold uppercase">{{ r.kindLabel }}</span>
              <span>{{ r.label }}</span>
            </li>
          }
        </ul>
      }

      @if (canEdit()) {
        <div class="mt-auto flex gap-2 pt-2">
          <button uiGhost type="button" (click)="edit.emit()">Edit</button>
          <button uiDanger type="button" (click)="remove.emit()">Delete</button>
        </div>
      }
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodexEntryCardComponent {
  readonly entry = input.required<CodexEntry>();
  readonly canEdit = input<boolean>(false);
  readonly edit = output<void>();
  readonly remove = output<void>();

  private readonly characters = inject(CharactersService);
  private readonly places = inject(PlacesService);
  private readonly events = inject(EventsService);
  private readonly stories = inject(StoriesService);
  private readonly plotlines = inject(PlotlinesService);
  private readonly items = inject(ItemsService);
  private readonly factions = inject(FactionsService);
  private readonly codex = inject(CodexEntriesService);

  protected readonly relatedLabels = computed(() => {
    const refs = this.entry().relatedRefs ?? [];
    return refs.map((r) => ({
      key: `${r.kind}:${r.id}`,
      kindLabel: KIND_LABEL[r.kind],
      label: this.resolveLabel(r.kind, r.id),
    }));
  });

  private resolveLabel(kind: EntityKind, id: string): string {
    switch (kind) {
      case 'character':
        return this.characters.characters().find((c) => c.id === id)?.name ?? '?';
      case 'place':
        return this.places.places().find((p) => p.id === id)?.name ?? '?';
      case 'event':
        return this.events.events().find((e) => e.id === id)?.name ?? '?';
      case 'story':
        return this.stories.publishedStories().find((s) => s.id === id)?.title ?? '?';
      case 'plotline':
        return this.plotlines.plotlines().find((p) => p.id === id)?.title ?? '?';
      case 'item':
        return this.items.items().find((i) => i.id === id)?.name ?? '?';
      case 'faction':
        return this.factions.factions().find((f) => f.id === id)?.name ?? '?';
      case 'codexEntry':
        return this.codex.entries().find((e) => e.id === id)?.title ?? '?';
    }
  }
}
